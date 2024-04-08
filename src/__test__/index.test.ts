import { pairing } from './simulator/index';
import { expect } from '@jest/globals';
import { SnapConfirmationInterface, installSnap } from '@metamask/snaps-jest';
import { DialogType, panel, text } from '@metamask/snaps-sdk';
import { divider, heading } from '@metamask/snaps-ui';
import { SnapError, SnapErrorCode } from '../error';
import { DAPP_URL_STAGING, InternalMethod } from '../permissions';
import * as simulator from './simulator';
import { SimpleKeyring } from '../snap/keyring';
import { DistributedKey, PairingData, SignMetadata, Wallet } from '../types';
import { IP1KeyShare } from '@silencelaboratories/ecdsa-tss';
import { delay, fromHexStringToBytes } from '../snap/utils';
import * as SignAction from '../snap/actions/sign';
import { TransactionFactory } from '@ethereumjs/tx';
import { Common, Hardfork } from '@ethereumjs/common';

const ORIGIN = DAPP_URL_STAGING;
const INIT_PAIR_PANEL_HEADING = `Hey there! 👋🏻 Welcome to Silent Shard Snap – your gateway to distributed-self custody!`;
const INIT_PAIR_PANEL_DESCRIPTION = [
	'👉🏻 To get started, grab the companion Silent Shard app from either the Apple App Store or Google Play.',
	`👉🏻 Just search for 'Silent Shard' and follow the simple steps to set up your MPC account.`,
	`Happy to have you onboard! 🥳`,
];
const WALLER_ADDRESS = '0x660265edc169bab511a40c0e049cc1e33774443d';

export const DEVICE_NAME =
	'e2e-test-device' + Math.floor(Math.random() * 1000000);
interface QrCode {
	pairingId: string;
	webEncPublicKey: string;
	signPublicKey: string;
}

afterAll(() => {
	simulator.cleanUpSimulation();
});

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

	describe('pairing and key generation', () => {
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

		it('tss_initPairing, tss_runPairing, tss_runKeygen should be success', async () => {
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

			const accountId = keyshareResult.distributedKey.accountId;
			const keyring = new SimpleKeyring({
				wallets: {
					[accountId]: {
						account: {
							id: 'f4211653-1b5f-4497-b5e6-f7b56824ba21',
							options: {},
							address: WALLER_ADDRESS,
							methods: [
								'eth_sign',
								'eth_signTransaction',
								'eth_signTypedData_v1',
								'eth_signTypedData_v3',
								'eth_signTypedData_v4',
								'personal_sign',
							],
							type: 'eip155:eoa',
						},
						distributedKey: keyshareResult.distributedKey,
					},
				},
				requests: {},
			});

			const pairingData = keyshareResult.pairingData;
			const runTssSign = async (
				hashAlg: string,
				message: string,
				messageHashHex: string,
				signMetadata: SignMetadata,
				accountId: number,
				keyShare: IP1KeyShare,
			) => {
				if (messageHashHex.startsWith('0x')) {
					messageHashHex = messageHashHex.slice(2);
				}
				if (message.startsWith('0x')) {
					message = message.slice(2);
				}

				// TODO: Do we want to simulate token expiration?
				// let silentShareStorage = await getSilentShareStorage();
				// let pairingData = silentShareStorage.pairingData;
				// if (pairingData.tokenExpiration < Date.now() - TOKEN_LIFE_TIME) {
				// 	pairingData = await refreshPairing();
				// }
				let messageHash = fromHexStringToBytes(messageHashHex);
				if (messageHash.length !== 32) {
					throw new SnapError(
						'Invalid length of messageHash, should be 32 bytes',
						SnapErrorCode.InvalidMessageHashLength,
					);
				}

				return await SignAction.sign(
					pairingData,
					keyShare,
					hashAlg,
					message,
					messageHash,
					signMetadata,
					accountId,
				);
			};

			// Test eip1559 signing
			const mockEip1559Tx: any = {
				type: '0x2',
				nonce: '0x1',
				to: '0x0c54fccd2e384b4bb6f2e405bf5cbc15a017aafb',
				from: WALLER_ADDRESS,
				value: '0x0',
				data: '0x',
				gasLimit: '0x5208',
				maxPriorityFeePerGas: '0x3b9aca00',
				maxFeePerGas: '0x2540be400',
				accessList: [],
				chainId: '0xaa36a7',
			};
			let eip1559SignResult: any = null;

			keyring
				.signTransaction(mockEip1559Tx, runTssSign)
				.then((resp: any) => {
					eip1559SignResult = resp;
				})
				.catch((err) => {
					console.log('err', err);
				});
			await simulator.sign();

			await delay(1000);

			for (const key in mockEip1559Tx) {
				if (Object.prototype.hasOwnProperty.call(mockEip1559Tx, key)) {
					expect(eip1559SignResult[key]).toEqual(mockEip1559Tx[key]);
				}
			}

			const common = Common.custom(
				{ chainId: eip1559SignResult.chainId },
				{
					hardfork:
						eip1559SignResult.maxPriorityFeePerGas ||
						eip1559SignResult.maxFeePerGas
							? Hardfork.London
							: Hardfork.Istanbul,
				},
			);
			let eip1559tx = TransactionFactory.fromTxData(eip1559SignResult, {
				common,
			});
			expect(eip1559tx.verifySignature()).toEqual(true);

			// Test legacy signing
			const mockLegacyTx: any = {
				type: '0x0',
				nonce: '0x0',
				to: '0x0c54fccd2e384b4bb6f2e405bf5cbc15a017aafb',
				from: WALLER_ADDRESS,
				value: '0x0',
				data: '0x',
				gasLimit: '0x5208',
				gasPrice: '0x2540be400',
				chainId: '0xaa36a7',
			};

			let legacySignResult: any = null;
			keyring
				.signTransaction(mockLegacyTx, runTssSign)
				.then((resp: any) => {
					legacySignResult = resp;
				})
				.catch((err) => {
					console.log('err', err);
				});

			await delay(3000);

			for (const key in mockLegacyTx) {
				if (Object.prototype.hasOwnProperty.call(mockLegacyTx, key)) {
					expect(legacySignResult[key]).toEqual(mockLegacyTx[key]);
				}
			}

			const commonLegacy = Common.custom(
				{ chainId: legacySignResult.chainId },
				{
					hardfork:
						legacySignResult.maxPriorityFeePerGas ||
						legacySignResult.maxFeePerGas
							? Hardfork.London
							: Hardfork.Istanbul,
				},
			);
			let legacyTx = TransactionFactory.fromTxData(legacySignResult, {
				common: commonLegacy,
			});
			expect(legacyTx.verifySignature()).toEqual(true);

			// Test typed data sign
			// const mockTypedDataTx =
			// Test personal sign
			const mockPersonalMsg = `0x${Buffer.from('Hello, world!').toString(
				'hex',
			)}`;
			let personalSignResult: any = null;
			keyring
				.signPersonalMessage(
					WALLER_ADDRESS,
					mockPersonalMsg,
					runTssSign,
				)
				.then((resp: any) => {
					personalSignResult = resp;
				})
				.catch((err) => {
					console.log('err', err);
				});

			await delay(3000);
			const helloWorldSignature =
				'0x90a938f7457df6e8f741264c32697fc52f9a8f867c52dd70713d9d2d472f2e415d9c94148991bbe1f4a1818d1dff09165782749c877f5cf1eff4ef126e55714d1c';
			expect(mockPersonalMsg).toEqual(helloWorldSignature);

			// Test eth sign
			// const mockEthSign =
		});

		it('tss_unpair should be success', async () => {
			simulator.backup();
			const { request } = await installSnap();
			const unpairReq = request({
				method: InternalMethod.TssUnPair,
				origin: ORIGIN,
			});
			await unpairReq;
		});

		it('repairing: without tss_runRePairing should be success', async () => {
			const { request } = await installSnap();

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

			await simulator.signIn();
			await simulator.pairing(qrCode, true);

			const runPairingReq = request({
				method: InternalMethod.TssRunPairing,
				origin: ORIGIN,
			});

			const runPairingJson: any = (await runPairingReq).response;
			const runPairingResult =
				runPairingJson.result as RunPairingResponse;
			expect(runPairingResult.deviceName).toEqual(DEVICE_NAME);
			expect(runPairingResult.address).toEqual(expect.any(String));
		});
	});
});
