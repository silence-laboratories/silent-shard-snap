import { expect } from '@jest/globals';
import { SnapConfirmationInterface, installSnap } from '@metamask/snaps-jest';
import { DialogType, panel, text, divider, heading } from '@metamask/snaps-sdk';
import { SnapError, SnapErrorCode } from '../error';
import { DAPP_URL_STAGING, InternalMethod } from '../permissions';
import * as simulator from './simulator';
import { SimpleKeyring } from '../snap/keyring';
import { DistributedKey, PairingData } from '../types';
import { delay, getAddressFromDistributedKey } from '../snap/utils';

import { TransactionFactory } from '@ethereumjs/tx';
import { Common, Hardfork } from '@ethereumjs/common';
import {
	SignTypedDataVersion,
	recoverPersonalSignature, // TODO: Use these methods to verify the signature
	recoverTypedSignature,
} from '@metamask/eth-sig-util';
import {
	genMockRunTssSign,
	mockPersonalMsg,
	mockSignTypedDataV4,
	mockSignTypedDataV3,
	mockSignTypedDataV1,
	genMockKeyring,
	genMockLegacyTx,
	genMockEip1559Tx,
	Eip1559Tx,
	LegacyTx,
} from './mocks';

const ORIGIN = DAPP_URL_STAGING;
const INIT_PAIR_PANEL_HEADING = `Hey there! 👋🏻 Welcome to Silent Shard Snap – your gateway to distributed-self custody!`;
const INIT_PAIR_PANEL_DESCRIPTION = [
	'👉🏻 To get started, grab the companion Silent Shard app from either the Apple App Store or Google Play.',
	`👉🏻 Just search for 'Silent Shard' and follow the simple steps to set up your MPC account.`,
	`Happy to have you onboard! 🥳`,
];

export const DEVICE_NAME =
	'e2e-test-device' + Math.floor(Math.random() * 1000000);
interface QrCode {
	pairingId: string;
	webEncPublicKey: string;
	signPublicKey: string;
}

describe('test rpc requests to Snap', () => {
	describe('wrong permission and rejection', () => {
		it('throws an error if origin does not have permission', async () => {
			const { request } = await installSnap();

			const response = await request({
				method: 'tss_initPairing',
			});

			expect(response).toRespondWithError({
				code: -32603,
				message:
					"Origin 'https://metamask.io' is not allowed to call 'tss_initPairing'",
				stack: expect.any(String),
			});
		});

		it('throws an error if the requested method does not exist', async () => {
			const { request } = await installSnap();

			const response = await request({
				method: 'foo',
				origin: ORIGIN,
			});

			expect(response).toRespondWithError({
				code: -32603,
				message: `Origin '${DAPP_URL_STAGING}' is not allowed to call 'foo'`,
				stack: expect.any(String),
			});
		});

		it('throws a custom error if key pairing rejected', async () => {
			const { request } = await installSnap();

			const response = request({
				method: InternalMethod.TssInitPairing,
				origin: ORIGIN,
				params: [{ isRePair: false }],
			});

			const ui =
				(await response.getInterface()) as SnapConfirmationInterface;
			expect(ui.type).toBe(DialogType.Confirmation);
			await ui.cancel();

			const respJson: any = (await response).response;
			const errorResp = respJson.error;
			const snapErrorJson = errorResp.message;
			const snapError = JSON.parse(snapErrorJson) as SnapError;

			expect(snapError.message).toEqual('Pairing is rejected.');
			expect(snapError.code).toEqual(
				SnapErrorCode.RejectedPairingRequest,
			);
		});
	});

	describe('pairing, key generation, signing', () => {
		it('tss_isPaired should be failed before pairing', async () => {
			const { request } = await installSnap();

			const response = request({
				method: InternalMethod.TssIsPaired,
				origin: ORIGIN,
			});

			expect(await response).toRespondWith({
				isPaired: false,
				deviceName: null,
			});
		});

		it('tss_initPairing, tss_runPairing, tss_runKeygen, eip1559 tx signing should be success', async () => {
			const { request } = await installSnap();
			// Test init pairing
			const initPairingReq = request({
				method: InternalMethod.TssInitPairing,
				origin: ORIGIN,
				params: [{ isRePair: false }],
			});

			const ui = await initPairingReq.getInterface();
			expect(ui.type).toBe(DialogType.Confirmation);
			const prompt = INIT_PAIR_PANEL_HEADING;
			const description = INIT_PAIR_PANEL_DESCRIPTION;
			expect(ui).toRender(
				panel([
					heading(prompt),
					divider(),
					...description.map((t) => text(t)),
				]),
			);

			await ui.ok();

			const initPairingJson: any = (await initPairingReq).response;
			const initPairingResult =
				initPairingJson.result as InitPairingResponse;
			const qrCode = initPairingResult.qrCode;
			const qrCodeObj = JSON.parse(qrCode) as QrCode;

			expect(qrCodeObj.pairingId).toEqual(expect.any(String));
			expect(qrCodeObj.webEncPublicKey).toEqual(expect.any(String));
			expect(qrCodeObj.signPublicKey).toEqual(expect.any(String));

			// Test run pairing
			await simulator.signIn();
			await simulator.pairing(qrCode);

			const runPairingReq = request({
				method: InternalMethod.TssRunPairing,
				origin: ORIGIN,
			});

			const runPairingJson: any = (await runPairingReq).response;
			const runPairingResult =
				runPairingJson.result as RunPairingResponse;
			expect(runPairingResult.deviceName).toEqual(DEVICE_NAME);
			expect(runPairingResult.address).toBeNull();

			// Test key generation
			const keygenReq = request({
				method: InternalMethod.TssRunKeygen,
				origin: ORIGIN,
			});
			await simulator.keygen();

			const keyGenJson: any = (await keygenReq).response;
			const runKeyGenResult = keyGenJson.result as RunKeygenResponse;
			expect(runKeyGenResult.address).toEqual(expect.any(String));

			request({
				method: InternalMethod.TssRunBackup,
				origin: ORIGIN,
			});

			// Test signing
			const keyshareReq = request({
				method: InternalMethod.E2eTestGetKeyShare,
				origin: ORIGIN,
			});
			const keyshareReqJson: any = (await keyshareReq).response;
			const keyshareResult = keyshareReqJson.result as {
				distributedKey: DistributedKey;
				pairingData: PairingData;
			};
			const pairingData = keyshareResult.pairingData;
			const runTssSign = genMockRunTssSign(pairingData);
			const walletAddress = getAddressFromDistributedKey(
				keyshareResult.distributedKey,
			);

			const simpleKeyring = genMockKeyring(
				keyshareResult.distributedKey,
				walletAddress,
			);
			const keyring = new SimpleKeyring(simpleKeyring);

			// Eip1559 sign
			let eip1559SignResult: Eip1559Tx | null = null;
			const mockEip1559Tx: Eip1559Tx = genMockEip1559Tx(walletAddress);
			const unsub = await simulator.sign();
			keyring
				.signTransaction(mockEip1559Tx, runTssSign)
				.then((resp: any) => {
					eip1559SignResult = resp;
				})
				.catch((err) => {
					console.log('err', err);
				});

			while (!eip1559SignResult) {
				// to wait for keyring sign result, if we remove this the thread will be blocked
				await delay(0);
			}

			for (const key in mockEip1559Tx) {
				if (Object.prototype.hasOwnProperty.call(mockEip1559Tx, key)) {
					expect(eip1559SignResult[key]).toEqual(mockEip1559Tx[key]);
				}
			}

			const common = Common.custom(
				{ chainId: parseInt((eip1559SignResult as Eip1559Tx).chainId, 16) },
				{
					hardfork:
						(eip1559SignResult as Eip1559Tx).maxPriorityFeePerGas ||
						(eip1559SignResult as Eip1559Tx).maxFeePerGas
							? Hardfork.London
							: Hardfork.Istanbul,
				},
			);
			let eip1559tx = TransactionFactory.fromTxData(eip1559SignResult, {
				common,
			});
			expect(eip1559tx.verifySignature()).toEqual(true);

			// Legacy sign
			let legacySignResult: LegacyTx | null = null;
			const mockLegacyTx: LegacyTx = genMockLegacyTx(walletAddress);
			keyring
				.signTransaction(mockLegacyTx, runTssSign)
				.then((resp: any) => {
					legacySignResult = resp;
				})
				.catch((err) => {
					console.log('err', err);
				});

			while (!legacySignResult) {
				// to wait for keyring sign result, if we remove this the thread will be blocked
				await delay(0);
			}

			for (const key in mockLegacyTx) {
				if (Object.prototype.hasOwnProperty.call(mockLegacyTx, key)) {
					expect(legacySignResult[key]).toEqual(mockLegacyTx[key]);
				}
			}

			const commonLegacy = Common.custom(
				{ chainId: parseInt((legacySignResult as LegacyTx).chainId, 16) },
				{
					hardfork:
						(legacySignResult as LegacyTx).maxPriorityFeePerGas ||
						(legacySignResult as LegacyTx).maxFeePerGas
							? Hardfork.London
							: Hardfork.Istanbul,
				},
			);
			let legacyTx = TransactionFactory.fromTxData(legacySignResult, {
				common: commonLegacy,
			});
			expect(legacyTx.verifySignature()).toEqual(true);

			// Personal sign
			let personalSignResult: string | null = null;
			keyring
				.signPersonalMessage(walletAddress, mockPersonalMsg, runTssSign)
				.then((resp: string) => {
					personalSignResult = resp;
				})
				.catch((err) => {
					console.log('err', err);
				});
			while (!personalSignResult) {
				// to wait for keyring sign result, if we remove this the thread will be blocked
				await delay(0);
			}
			expect(personalSignResult).toEqual(expect.any(String));
			expect(personalSignResult).toMatch(/^0x/);

			const recoveredAddr = recoverPersonalSignature({
				data: mockPersonalMsg,
				signature: personalSignResult,
			});

			expect(recoveredAddr).toEqual(walletAddress);

			// Typed v4 sign
			let typedV4SignResult: string | null = null;

			keyring
				.signTypedData(
					walletAddress,
					mockSignTypedDataV4,
					{ version: SignTypedDataVersion.V4 },
					'eth_signTypedData_v4',
					runTssSign,
				)
				.then((resp: string) => {
					typedV4SignResult = resp;
				})
				.catch((err) => {
					console.log('err', err);
				});
			while (!typedV4SignResult) {
				// to wait for keyring sign result, if we remove this the thread will be blocked
				await delay(0);
			}
			expect(typedV4SignResult).toEqual(expect.any(String));
			expect(typedV4SignResult).toMatch(/^0x/);

			const v4RecoveredAddr = recoverTypedSignature({
				data: mockSignTypedDataV4 as any,
				signature: typedV4SignResult,
				version: SignTypedDataVersion.V4,
			});

			expect(v4RecoveredAddr).toEqual(walletAddress);

			// Typed v3 sign
			let typedV3SignResult: string | null = null;

			keyring
				.signTypedData(
					walletAddress,
					mockSignTypedDataV3,
					{ version: SignTypedDataVersion.V3 },
					'eth_signTypedData_v3',
					runTssSign,
				)
				.then((resp: string) => {
					typedV3SignResult = resp;
				})
				.catch((err) => {
					console.log('err', err);
				});
			while (!typedV3SignResult) {
				// to wait for keyring sign result, if we remove this the thread will be blocked
				await delay(0);
			}
			expect(typedV3SignResult).toEqual(expect.any(String));
			expect(typedV3SignResult).toMatch(/^0x/);

			const v3RecoveredAddr = recoverTypedSignature({
				data: mockSignTypedDataV3 as any,
				signature: typedV3SignResult,
				version: SignTypedDataVersion.V3,
			});

			expect(v3RecoveredAddr).toEqual(walletAddress);

			// Typed sign
			let typedV1SignResult: string | null = null;

			keyring
				.signTypedData(
					walletAddress,
					mockSignTypedDataV1,
					{ version: SignTypedDataVersion.V1 },
					'eth_signTypedData_v1',
					runTssSign,
				)
				.then((resp: string) => {
					typedV1SignResult = resp;
				})
				.catch((err) => {
					console.log('err', err);
				});
			while (!typedV1SignResult) {
				// to wait for keyring sign result, if we remove this the thread will be blocked
				await delay(0);
			}
			expect(typedV1SignResult).toEqual(expect.any(String));
			expect(typedV1SignResult).toMatch(/^0x/);

			const v1RecoveredAddr = recoverTypedSignature({
				data: mockSignTypedDataV1,
				signature: typedV1SignResult,
				version: SignTypedDataVersion.V1,
			});

			expect(v1RecoveredAddr).toEqual(walletAddress);

			unsub!();
			await simulator.cleanUpSimulation();
		});
	});

	// TODO: We only able to test this if @metamask/snaps-jest package supports Keyring API
	// it('tss_runRePairing should be success', async () => {
	// });
});
