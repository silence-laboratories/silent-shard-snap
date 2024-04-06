// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import {
	DialogType,
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
import { snapVersion } from './firebaseApi';
import {
	InternalMethod,
	PERMISSIONS,
	STAGING_PERMISSIONS,
} from './permissions';
import { pubToAddress } from '@ethereumjs/util';
import { version as SNAP_VERSION } from './../package.json';
import { StorageData } from './types';
window.Buffer = window.Buffer || Buffer;

let keyring: SimpleKeyring;

const showConfirmationMessage = async (
	prompt: string,
	description: string[],
) => {
	return await snap.request({
		method: 'snap_dialog',
		params: {
			type: DialogType.Confirmation,
			content: panel([
				heading(prompt),
				divider(),
				...description.map((t) => text(t)),
			]),
		},
	});
};

const hasPermission = (origin: string, method: string): boolean => {
	if (process.env.IS_PRODUCTION) {
		return Boolean(PERMISSIONS.get(origin)?.includes(method));
	}
	return (
		Boolean(PERMISSIONS.get(origin)?.includes(method)) ||
		Boolean(STAGING_PERMISSIONS.get(origin)?.includes(method))
	);
};

export const onRpcRequest: OnRpcRequestHandler = async ({
	origin,
	request,
}) => {
	if (!hasPermission(origin, request.method)) {
		throw new Error(
			`Origin '${origin}' is not allowed to call '${request.method}'`,
		);
	}
	switch (request.method) {
		case InternalMethod.TssIsPaired:
			return await isPaired();

		case InternalMethod.TssUnPair:
			await deleteStorage();
			return;

		/**
		 * tss_initPairing
		 * @abstract This function initialise the pairing and return the qr code data
		 *
		 * @returns
		 * qrCode: String contains qr code data
		 *
		 * @throws
		 * 1. RejectedPairingRequest, when user rejected the pairing request
		 * 2. UnknownError, when something unknown error occurs
		 */
		case InternalMethod.TssInitPairing:
			const isRePair = (request.params as [{ isRePair: boolean }])[0]
				.isRePair;
			if (!isRePair) {
				let initPairingRequest = await showConfirmationMessage(
					`Hey there! 👋🏻 Welcome to Silent Shard Snap – your gateway to distributed-self custody!`,
					[
						'👉🏻 To get started, grab the companion Silent Shard app from either the Apple App Store or Google Play.',
						`👉🏻 Just search for 'Silent Shard' and follow the simple steps to set up your MPC account.`,
						`Happy to have you onboard! 🥳`,
					],
				);

				if (!initPairingRequest) {
					throw new SnapError(
						'Pairing is rejected.',
						SnapErrorCode.RejectedPairingRequest,
					);
				}
			}
			const qrCodeMessage = await sdk.initPairing();
			return {
				qrCode: qrCodeMessage,
			};

		/**
		 * tss_runPairing
		 * @abstract This start pairing process with phone and fetch the auth token
		 *
		 * @returns
		 * address, if found backup data then return String otherwise null
		 * deviceName, the name of device it is paired
		 *
		 * @throws
		 * 1. PairingNotInitialized, when runPairing is called before the initPairing
		 * 2. InvalidBackupData, when snap get invalid backup data, or wrong secret key for the given ciphertext
		 * 3. StorageError, when snap fails to store data in MM snap state,
		 * 4. FirebaseError, when error occurs on server side, message will contains info,
		 * 6. UnknownError, when something unknown error occurs
		 */
		case InternalMethod.TssRunPairing:
			const pairingRes = await sdk.runPairing();
			return {
				address: pairingRes.newAccountAddress,
				deviceName: pairingRes.deviceName,
			};

		/**
		 * tss_runRePairing
		 * @abstract This start pairing process with phone and fetch the auth token
		 *
		 * @returns
		 * currentAccountAddress, return the array of current account addresses, array for future use
		 * newAccountAddress, can be null, return the new account addess if we get from backup.
		 * deviceName, the name of device it is re-paired to
		 *
		 * @throws
		 * 1. PairingNotInitialized, when runPairing is called before the initPairing
		 * 2. InvalidBackupData, when snap get invalid backup data, or wrong secret key for the given ciphertext
		 * 3. StorageError, when snap fails to store data in MM snap state,
		 * 4. FirebaseError, when error occurs on server side, message will contains info,
		 * 6. UnknownError, when something unknown error occurs
		 */
		case InternalMethod.TssRunRePairing:
			const repairingRes = await sdk.runRePairing();
			return {
				currentAccountAddress: repairingRes.currentAccountAddress,
				newAccountAddress: repairingRes.newAccountAddress,
				deviceName: repairingRes.deviceName,
			};

		/**
		 * tss_runKeygen
		 * @abstract This start keygen process between phone and snap, and will create key pairs.
		 * Checks if runPairing has backup data, if backup data is used then will return same address without initiating the keygen process.
		 *
		 * @returns
		 * address, String of address
		 *
		 * @throws
		 * 1. NotPaired, if snap is not paired yet.
		 * 2. FirebaseError, when error occurs on server side, message will contains info,
		 * 3. StorageError, when snap fails to store data in MM snap state,
		 * 4. UnknownError, when something unknown error occurs
		 * 5. InternalLibError, when internal error in library
		 * 6. KeygenResourceBusy, when keygen is already running
		 * 7. UserPhoneDenied, when user deined from other device,
		 * 8. KeygenFailed, when keygen failed due to some other reason
		 */
		case InternalMethod.TssRunKeygen:
			const keygenRes = await sdk.runKeygen();
			await sdk.runBackup();
			return {
				address:
					'0x' +
					pubToAddress(
						Buffer.from(keygenRes.distributedKey.publicKey, 'hex'),
					).toString('hex'),
			};

		/**
		 * tss_snapVersion
		 * @abstract get the latest snap version and the version installed
		 *
		 * @returns
		 * currentVersion: current version of the snap installed,
		 * latestVersion: latest version of the snap available,
		 *
		 */
		case InternalMethod.TssSnapVersion:
			const snapLatestVersion = await snapVersion();

			return {
				currentVersion: SNAP_VERSION,
				latestVersion: snapLatestVersion,
			};

		case InternalMethod.E2eTestGetKeyShare:
			let silentShareStorage: StorageData = await getSilentShareStorage();
			return {
				distributedKey:
					silentShareStorage.newPairingState?.distributedKey,
				pairingData: silentShareStorage.pairingData,
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
	if (!hasPermission(origin, request.method)) {
		throw new Error(
			`Origin '${origin}' is not allowed to call '${request.method}'`,
		);
	}
	return handleKeyringRequest(await getKeyring(), request);
};
