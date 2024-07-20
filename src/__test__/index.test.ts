import { expect } from '@jest/globals';
import { SnapConfirmationInterface, installSnap, Snap } from '@metamask/snaps-jest';
import { panel, text, divider, heading } from '@metamask/snaps-ui';
import { SnapError, SnapErrorCode } from '../snap/error';
import { DAPP_URL_STAGING, InternalMethod } from '../permissions';
import { Simulator } from './simulator';
import SimpleKeyring from '../snap/keyring';
import { MockStorage } from './mockStorage'
import { StorageData } from '../snap/types';
import SnapSDK from '../snap/sdk';
import { DialogType } from '@metamask/snaps-types';
import { Signer } from './signerVerifier';
import { DEVICE_NAME, INIT_PAIR_PANEL_DESCRIPTION, INIT_PAIR_PANEL_HEADING, STAGING_ORIGIN } from './constants';
import { a } from './tests/test1';
import { test2 } from './tests/test2';


describe('test rpc requests to Snap', () => {
	describe('wrong permission and rejection', () => {
		test('throws an error if origin does not have permission', async () => {
			const { request } = await installSnap();

			const response = await request({
				method: 'tss_initPairing',
				// default origin is https://metamask.io
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
				origin: STAGING_ORIGIN,
			});

			expect(response).toRespondWithError({
				code: -32603,
				message: `Origin '${STAGING_ORIGIN}' is not allowed to call 'foo'`,
				stack: expect.any(String),
			});
		});

		it('throws a custom error if key pairing rejected', async () => {
			const { request } = await installSnap();

			const response = request({
				method: InternalMethod.TssInitPairing,
				origin: STAGING_ORIGIN,
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
				origin: STAGING_ORIGIN,
			});

			expect(await response).toRespondWith({
				isPaired: false,
				deviceName: null,
			});
		});

		it('tss_initPairing, tss_runPairing, tss_runKeygen, all keyring signing methods should be success', async () => {

			const { request } = await installSnap();
			// Test init pairing
			const initPairingReq = request({
				method: InternalMethod.TssInitPairing,
				origin: STAGING_ORIGIN,
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
			await Simulator.init();
			const simulator = new Simulator();
			await simulator.signIn();
			await simulator.pairing(qrCodeObj);

			const runPairingReq = request({
				method: InternalMethod.TssRunPairing,
				origin: STAGING_ORIGIN,
			});

			const runPairingJson: any = (await runPairingReq).response;
			const runPairingResult =
				runPairingJson.result as RunPairingResponse;
			expect(runPairingResult.deviceName).toEqual(DEVICE_NAME);
			expect(runPairingResult.address).toBeNull();

			// Test key generation
			const keygenReq = request({
				method: InternalMethod.TssRunKeygen,
				origin: STAGING_ORIGIN,
			});
			await simulator.keygen();

			const keyGenJson: any = (await keygenReq).response;
			const runKeyGenResult = keyGenJson.result as RunKeygenResponse;
			expect(runKeyGenResult.address).toEqual(expect.any(String));

			request({
				method: InternalMethod.TssRunBackup,
				origin: STAGING_ORIGIN,
			});

			const snapStorageReq = request({
				method: InternalMethod.E2eTestGetStorage,
				origin: STAGING_ORIGIN,
			});
			const snapStorageReqJson: any = (await snapStorageReq).response;
			const snapStorageData = snapStorageReqJson.result as StorageData;
			const mockStorage = new MockStorage(snapStorageData);
			const snapSdk = await SnapSDK.instance(mockStorage);
			const keyring = new SimpleKeyring(snapStorageData, mockStorage, snapSdk);
			const walletAddress = runKeyGenResult.address;
			const signer = new Signer(keyring, walletAddress);

			// Test sign
			const unsub = await simulator.sign();

			await signer.signAndVerifyEip1559Tx();
			await signer.signPersonalSign();
			await signer.signAndVerifyLegacyTx();
			await signer.signAndVerifySignTypedDataV1();
			await signer.signAndVerifySignTypedDataV3();
			await signer.signAndVerifySignTypedDataV4();

			unsub!();
			await simulator.cleanUpSimulation();
		});
	});

	// TODO: We only able to test this if @metamask/snaps-jest package supports Keyring API
	it('tss_runRePairing should be success', async () => {
		const { request } = await installSnap();
		// Test init pairing
		const initPairingReq = request({
			method: InternalMethod.TssInitPairing,
			origin: STAGING_ORIGIN,
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
		await Simulator.init();
		const simulator = new Simulator();
		await simulator.signIn();
		await simulator.pairing(qrCodeObj);

		const runPairingReq = request({
			method: InternalMethod.TssRunPairing,
			origin: STAGING_ORIGIN,
		});

		const runPairingJson: any = (await runPairingReq).response;
		const runPairingResult =
			runPairingJson.result as RunPairingResponse;
		expect(runPairingResult.deviceName).toEqual(DEVICE_NAME);
		expect(runPairingResult.address).toBeNull();

		// Test key generation
		const keygenReq = request({
			method: InternalMethod.TssRunKeygen,
			origin: STAGING_ORIGIN,
		});
		await simulator.keygen();

		const keyGenJson: any = (await keygenReq).response;
		const runKeyGenResult = keyGenJson.result as RunKeygenResponse;
		expect(runKeyGenResult.address).toEqual(expect.any(String));

		request({
			method: InternalMethod.TssRunBackup,
			origin: STAGING_ORIGIN,
		});

		await simulator.backup();

		console.log('ALLLLL GOOD');

		const snapStorageReq = request({
			method: InternalMethod.E2eTestGetStorage,
			origin: STAGING_ORIGIN,
		});
		const snapStorageReqJson: any = (await snapStorageReq).response;
		const snapStorageData = snapStorageReqJson.result as StorageData;

		// Test init re-pairing
		const initRePairingReq = request({
			method: InternalMethod.TssInitPairing,
			origin: STAGING_ORIGIN,
			params: [{ isRePair: true }],
		});

		const initRePairingJson: any = (await initRePairingReq).response;
		const initRePairingResult =
			initRePairingJson.result as InitPairingResponse;
		const rePairingQrCode = initRePairingResult.qrCode;
		const rePairingQrCodeObj = JSON.parse(rePairingQrCode) as QrCode;

		expect(rePairingQrCodeObj.pairingId).toEqual(expect.any(String));
		expect(rePairingQrCodeObj.webEncPublicKey).toEqual(expect.any(String));
		expect(rePairingQrCodeObj.signPublicKey).toEqual(expect.any(String));

		// Test run pairing
		await simulator.pairing(rePairingQrCodeObj, true);

		const runRePairingReq = request({
			method: InternalMethod.TssRunRePairing,
			origin: STAGING_ORIGIN,
		});

		const runRePairingJson: any = (await runRePairingReq).response;
		const runRePairingResult = runRePairingJson.result as RunRePairingResponse;

		expect(runKeyGenResult.address).toEqual(runRePairingResult.newAccountAddress);

		await simulator.cleanUpSimulation();
	});

	// it('tss_runRePairing with new account should be success', async () => {
	// 	const { request } = await installSnap();
	// 	// Test init pairing
	// 	const initPairingReq = request({
	// 		method: InternalMethod.TssInitPairing,
	// 		origin: STAGING_ORIGIN,
	// 		params: [{ isRePair: false }],
	// 	});

	// 	const ui = await initPairingReq.getInterface();
	// 	expect(ui.type).toBe(DialogType.Confirmation);
	// 	const prompt = INIT_PAIR_PANEL_HEADING;
	// 	const description = INIT_PAIR_PANEL_DESCRIPTION;
	// 	expect(ui).toRender(
	// 		panel([
	// 			heading(prompt),
	// 			divider(),
	// 			...description.map((t) => text(t)),
	// 		]),
	// 	);

	// 	await ui.ok();

	// 	const initPairingJson: any = (await initPairingReq).response;
	// 	const initPairingResult =
	// 		initPairingJson.result as InitPairingResponse;
	// 	const qrCode = initPairingResult.qrCode;
	// 	const qrCodeObj = JSON.parse(qrCode) as QrCode;

	// 	expect(qrCodeObj.pairingId).toEqual(expect.any(String));
	// 	expect(qrCodeObj.webEncPublicKey).toEqual(expect.any(String));
	// 	expect(qrCodeObj.signPublicKey).toEqual(expect.any(String));

	// 	// Test run pairing
	// 	await Simulator.init();
	// 	const simulator = new Simulator();
	// 	await simulator.signIn();
	// 	await simulator.pairing(qrCodeObj);

	// 	const runPairingReq = request({
	// 		method: InternalMethod.TssRunPairing,
	// 		origin: STAGING_ORIGIN,
	// 	});

	// 	const runPairingJson: any = (await runPairingReq).response;
	// 	const runPairingResult =
	// 		runPairingJson.result as RunPairingResponse;
	// 	expect(runPairingResult.deviceName).toEqual(DEVICE_NAME);
	// 	expect(runPairingResult.address).toBeNull();

	// 	// Test key generation
	// 	const keygenReq = request({
	// 		method: InternalMethod.TssRunKeygen,
	// 		origin: STAGING_ORIGIN,
	// 	});
	// 	await simulator.keygen();

	// 	const keyGenJson: any = (await keygenReq).response;
	// 	const runKeyGenResult = keyGenJson.result as RunKeygenResponse;
	// 	expect(runKeyGenResult.address).toEqual(expect.any(String));

	// 	request({
	// 		method: InternalMethod.TssRunBackup,
	// 		origin: STAGING_ORIGIN,
	// 	});

	// 	await simulator.backup();

	// 	console.log('ALLLLL GOOD');

	// 	const snapStorageReq = request({
	// 		method: InternalMethod.E2eTestGetStorage,
	// 		origin: STAGING_ORIGIN,
	// 	});
	// 	const snapStorageReqJson: any = (await snapStorageReq).response;
	// 	const snapStorageData = snapStorageReqJson.result as StorageData;

	// 	// Test init re-pairing
	// 	const initRePairingReq = request({
	// 		method: InternalMethod.TssInitPairing,
	// 		origin: STAGING_ORIGIN,
	// 		params: [{ isRePair: true }],
	// 	});

	// 	const initRePairingJson: any = (await initRePairingReq).response;
	// 	const initRePairingResult =
	// 		initRePairingJson.result as InitPairingResponse;
	// 	const rePairingQrCode = initRePairingResult.qrCode;
	// 	const rePairingQrCodeObj = JSON.parse(rePairingQrCode) as QrCode;

	// 	expect(rePairingQrCodeObj.pairingId).toEqual(expect.any(String));
	// 	expect(rePairingQrCodeObj.webEncPublicKey).toEqual(expect.any(String));
	// 	expect(rePairingQrCodeObj.signPublicKey).toEqual(expect.any(String));

	// 	// Test run pairing
	// 	await simulator.pairing(rePairingQrCodeObj, true);

	// 	const runRePairingReq = request({
	// 		method: InternalMethod.TssRunRePairing,
	// 		origin: STAGING_ORIGIN,
	// 	});

	// 	const runRePairingJson: any = (await runRePairingReq).response;
	// 	const runRePairingResult = runRePairingJson.result as RunRePairingResponse;

	// 	expect(runKeyGenResult.address).toEqual(runRePairingResult.newAccountAddress);

	// 	await simulator.cleanUpSimulation();
	// });

});
