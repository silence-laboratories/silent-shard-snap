import { expect } from '@jest/globals';
import { SnapConfirmationInterface, installSnap } from '@metamask/snaps-jest';
import { SnapError, SnapErrorCode } from '../snap/error';
import { InternalMethod } from '../permissions';
import { Simulator } from './simulator';
import { DialogType } from '@metamask/snaps-types';
import { STAGING_ORIGIN } from './constants';
import { SnapRepository } from './snapRepository';


describe('test rpc requests to Snap', () => {
	describe('wrong permission and rejection', () => {
		it('throws an error if origin does not have permission', async () => {
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

			const snapRepository = new SnapRepository(request);
			await snapRepository.isPaired();
		});

		it('tss_initPairing, tss_runPairing, tss_runKeygen, all keyring signing methods should be success', async () => {

			const { request } = await installSnap();

			const snapRepository = new SnapRepository(request);
			await Simulator.init();
			const simulator = new Simulator();
			await simulator.signIn();

			// Test init pairing
			const qrCode = await snapRepository.initPairing();


			// Test run pairing
			await simulator.pairing(qrCode);
			await snapRepository.runPairing();

			// Test key generation
			const keygenPromise = snapRepository.runKeygen();
			await simulator.keygen();
			await keygenPromise;

			// Test backup
			const backupPromise = snapRepository.runBackup();
			await simulator.backup();
			await backupPromise;

			// Test sign
			const unsub = await simulator.sign();
			await snapRepository.runSign();
			unsub();

			// Cleanup
			simulator.cleanUpSimulation();

		}, 60 * 1000);

		it('tss_runRePairing should be success', async () => {

			const { request } = await installSnap();

			const snapRepository = new SnapRepository(request);
			await Simulator.init();
			const simulator = new Simulator();
			await simulator.signIn();

			// Test init pairing
			const qrCode = await snapRepository.initPairing();


			// Test run pairing
			await simulator.pairing(qrCode);
			await snapRepository.runPairing();



			// Test key generation
			const keygenPromise = snapRepository.runKeygen();
			await simulator.keygen();
			await keygenPromise;



			// Test backup
			const backupPromise = snapRepository.runBackup();
			await simulator.backup();
			await backupPromise;





			// Test init rePairing
			const rePairingQrCode = await snapRepository.initPairing();

			// Test run rePairing
			await simulator.pairing(rePairingQrCode, true);
			await snapRepository.runRePairing();

			// Cleanup
			simulator.cleanUpSimulation();

		}, 60 * 1000);

		it('tss_runRePairing should be success with different account', async () => {

			const { request } = await installSnap();

			const snapRepository = new SnapRepository(request);
			await Simulator.init();

			const simulator = {
				A: new Simulator(),
				B: new Simulator()
			}

			await simulator.A.signIn();
			await simulator.B.signIn();

			{
				const qrCode = await snapRepository.initPairing();
				// Test run pairing
				await simulator.A.pairing(qrCode);
				await snapRepository.runPairing();
				// Test run keygen
				const keygenPromise = snapRepository.runKeygen();
				await simulator.A.keygen();
				await keygenPromise;
				// Test backup
				const backupPromise = snapRepository.runBackup();
				await simulator.A.backup();
				await backupPromise;
			}

			await snapRepository.unPair();

			{
				const qrCode = await snapRepository.initPairing();
				// Test run pairing
				await simulator.B.pairing(qrCode);
				await snapRepository.runPairing();
				// Test run keygen
				const keygenPromise = snapRepository.runKeygen();
				await simulator.B.keygen();
				await keygenPromise;
				// Test backup
				const backupPromise = snapRepository.runBackup();
				await simulator.A.backup();
				await backupPromise;
			}

			// Test init rePairing
			const rePairingQrCode = await snapRepository.initPairing();
			// Test run rePairing
			await simulator.A.pairing(rePairingQrCode, true);
			await snapRepository.runRePairing(simulator.A.getWalletAddress());

			// Cleanup
			simulator.A.cleanUpSimulation();
			simulator.B.cleanUpSimulation();

		}, 60 * 1000);
	});
});
