import { expect } from '@jest/globals';
import { SnapConfirmationInterface, installSnap } from '@metamask/snaps-jest';
import { DialogType, panel, text } from '@metamask/snaps-sdk';
import { divider, heading } from '@metamask/snaps-ui';
import { SnapError, SnapErrorCode } from '../error';
import { InternalMethod } from '../permissions';
import * as simulator from './simulator';

const ORIGIN = 'https://snap.silencelaboratories.com';
const INIT_PAIR_PANEL_HEADING = `Hey there! 👋🏻 Welcome to Silent Shard Snap – your gateway to distributed-self custody!`;
const INIT_PAIR_PANEL_DESCRIPTION = [
	'👉🏻 To get started, grab the companion Silent Shard app from either the Apple App Store or Google Play.',
	`👉🏻 Just search for 'Silent Shard' and follow the simple steps to set up your MPC account.`,
	`Happy to have you onboard! 🥳`,
]
export const DEVICE_NAME = 'e2e-test-device' + Math.floor(Math.random() * 1000000);
interface QrCode {
	pairingId: string;
	webEncPublicKey: string;
	signPublicKey: string;
}

afterAll(() => {
	simulator.cleanUpSimulation();
});

describe('onRpcRequest', () => {
	describe('check permission on rpc call', () => {
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
				message:
					"Origin 'https://snap.silencelaboratories.com' is not allowed to call 'foo'",
				stack: expect.any(String),
			});
		});
	});

	describe('key pairing and generation', () => {
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

			const keygenReq = request({
				method: InternalMethod.TssRunKeygen,
				origin: ORIGIN,
			});
			await simulator.keygen();

			const keyGenJson: any = (await keygenReq).response;
			const runKeyGenResult = keyGenJson.result as RunKeygenResponse;
			expect(runKeyGenResult.address).toEqual(expect.any(String));

			simulator.backup();
		});

		it('tss_unpair should be success', async () => {
			const { request } = await installSnap();
			const unpairReq = request({
				method: InternalMethod.TssUnPair,
				origin: ORIGIN,
			});
			await unpairReq;
		});

		it('repairing from mobile and non-repairing from dapp should be success', async () => {
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
});
