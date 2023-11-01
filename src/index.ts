import {
	OnKeyringRequestHandler,
	OnRpcRequestHandler,
} from '@metamask/snaps-types';
import * as sdk from './snap/sdk';
import { deleteStorage, getSilentShareStorage } from './snap/storage';
import { isPaired } from './snap/sdk';
import { panel, text, heading, divider } from '@metamask/snaps-ui';
import { SnapError, SnapErrorCode } from './error';
import { handleKeyringRequest } from '@metamask/keyring-api';
import { SimpleKeyring } from './snap/keyring';
import { snapVersion } from './firebaseEndpoints';
import { PERMISSIONS } from './permissions';
import { pubToAddress } from '@ethereumjs/util';
import { StorageData } from './types';
window.Buffer = window.Buffer || Buffer;

let keyring: SimpleKeyring;
const SNAP_VERSION = '1.1.19';

const showConfirmationMessage = async (
	prompt: string,
	description: string,
	textAreaContent: string,
) => {
	return await snap.request({
		method: 'snap_dialog',
		params: {
			type: 'confirmation',
			content: panel([
				heading(prompt),
				divider(),
				text(description),
				text(textAreaContent),
			]),
		},
	});
};

const hasPermission = (origin: string, method: string): boolean => {
	return Boolean(PERMISSIONS.get(origin)?.includes(method));
};

export const onRpcRequest: OnRpcRequestHandler = async ({
	origin,
	request,
}) => {
	console.log(
		`[Snap] custom method request (id=${
			request.id ?? 'null'
		}, origin=${origin}):`,
		request,
	);
	if (!hasPermission(origin, request.method)) {
		throw new Error(
			`Origin '${origin}' is not allowed to call '${request.method}'`,
		);
	}
	switch (request.method) {
		case 'tss_isPaired':
			return await isPaired();

		case 'tss_unpair':
			await deleteStorage();
			return;
		case 'tss_initPairing':
			let initPairingRequest = await showConfirmationMessage(
				`Hello, ${origin}!`,
				'Pairing with a new mobile application?',
				'Create a new pair between Metamask Plugin and SilentShard mobile application',
			);

			if (!initPairingRequest) {
				throw new SnapError(
					'User Rejected Request for Pairing',
					SnapErrorCode.RejectedRequest,
				);
			}
			const qrCodeMessage = await sdk.initPairing();
			return {
				qrCode: qrCodeMessage,
			};

		case 'tss_runPairing':
			const pairingRes = await sdk.runPairing();
			if (pairingRes.usedBackupData && pairingRes.tempDistributedKey) {
				return {
					address:
						'0x' +
						pubToAddress(
							Buffer.from(
								pairingRes.tempDistributedKey.publicKey,
								'hex',
							),
						).toString('hex'), // pairingRes.temp_distributed_key.account_id,
				};
			}
			return { address: null };

		case 'tss_runKeygen':
			let silentShareStorage: StorageData = await getSilentShareStorage();
			if (silentShareStorage.tempDistributedKey) {
				return {
					address:
						'0x' +
						pubToAddress(
							Buffer.from(
								silentShareStorage.tempDistributedKey.publicKey,
								'hex',
							),
						).toString('hex'),
				};
			} else {
				const keygenRes = await sdk.runKeygen();
				await sdk.runBackup();
				return {
					address:
						'0x' +
						pubToAddress(
							Buffer.from(
								keygenRes.distributedKey.publicKey,
								'hex',
							),
						).toString('hex'),
				};
			}

		case 'tss_runRefresh':
			return await sdk.refreshPairing();

		case 'tss_snapVersion':
			const snapLatestVersion = await snapVersion();

			return {
				currentVersion: SNAP_VERSION,
				latestVersion: snapLatestVersion,
			};

		default:
			throw new SnapError('Unknown method', SnapErrorCode.UnknownMethod);
	}
};

const getKeyring = async (): Promise<SimpleKeyring> => {
	if (!keyring) {
		if (!keyring) {
			try {
				const keyringState = await getSilentShareStorage();
				keyring = new SimpleKeyring(keyringState);
			} catch {
				keyring = new SimpleKeyring({ wallets: {}, requests: {} });
			}
		}
	}
	return keyring;
};

export const onKeyringRequest: OnKeyringRequestHandler = async ({
	request,
	origin,
}) => {
	console.log(
		`[Snap] keyring request (id=${
			request.id ?? 'null'
		}, origin=${origin}):`,
		request,
	);
	if (!hasPermission(origin, request.method)) {
		throw new Error(
			`Origin '${origin}' is not allowed to call '${request.method}'`,
		);
	}
	return handleKeyringRequest(await getKeyring(), request);
};
