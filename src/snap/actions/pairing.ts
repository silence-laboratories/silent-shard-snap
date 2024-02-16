import * as utils from '../utils';
import {
	getTokenEndpoint,
	refreshTokenEndpoint,
	sendMessage,
} from '../../firebaseApi';
import _sodium from 'libsodium-wrappers';
import { DistributedKey, PairingData, StorageData, Wallet } from '../../types';
import { SnapError, SnapErrorCode } from '../../error';
import { decMessage } from '../entropy';
import { v4 as uuid } from 'uuid';

export interface PairingDataInit {
	pairingId: string;
	encPair: _sodium.KeyPair;
	signPair: _sodium.KeyPair;
}

let pairingDataInit: PairingDataInit;

export const init = async () => {
	try {
		let pairingId = await utils.randomPairingId();

		await _sodium.ready;
		const encPair = _sodium.crypto_box_keypair();
		const signPair = _sodium.crypto_sign_keypair();

		pairingDataInit = {
			pairingId,
			encPair,
			signPair,
		};

		let qrCode = JSON.stringify({
			pairingId,
			webEncPublicKey: _sodium.to_hex(encPair.publicKey),
			signPublicKey: _sodium.to_hex(signPair.publicKey),
		});

		return qrCode;
	} catch (error) {
		if (error instanceof Error) {
			throw new SnapError(error.message, SnapErrorCode.UnknownError);
		} else throw new SnapError('unkown-error', SnapErrorCode.UnknownError);
	}
};

const updatePairingObject = async (
	token: string,
	pairingId: string,
	pairingObject:
		| { isPaired: boolean }
		| {
				isPaired: boolean;
				pairingFailureReason: string;
		  },
) => {
	await sendMessage(token, 'pairing', pairingObject, false, pairingId);
};

const getDistributedKeyFromBackupData = async (
	backupData: string,
): Promise<{ distributedKey: DistributedKey; accountAddress: string }> => {
	try {
		const decreptedMessage = await decMessage(backupData);
		const distributedKey = JSON.parse(
			utils.uint8ArrayToUtf8String(decreptedMessage),
		);
		let accountAddress = utils.getAddressFromDistributedKey(distributedKey);
		return {
			distributedKey,
			accountAddress,
		};
	} catch (error) {
		if (error instanceof SnapError) {
			throw error;
		} else if (error instanceof Error) {
			throw new SnapError(error.message, SnapErrorCode.InvalidBackupData);
		} else throw new SnapError('unknown-error', SnapErrorCode.UnknownError);
	}
};

export const getToken = async (currentAccountAddress?: string) => {
	try {
		if (!pairingDataInit) {
			throw new SnapError(
				'Pairing data not initialized',
				SnapErrorCode.PairingNotInitialized,
			);
		}

		let startTime = Date.now();

		const signature = _sodium.crypto_sign_detached(
			pairingDataInit.pairingId,
			pairingDataInit.signPair.privateKey,
		);

		const data = await getTokenEndpoint(
			pairingDataInit.pairingId,
			_sodium.to_hex(signature),
		);

		let tempDistributedKey: DistributedKey | null = null;
		let tempAccountAddress: string | null = null;

		if (data.backupData) {
			try {
				const { distributedKey, accountAddress } =
					await getDistributedKeyFromBackupData(data.backupData);
				tempDistributedKey = distributedKey;
				tempAccountAddress = accountAddress;
			} catch (error) {
				await updatePairingObject(
					data.token,
					pairingDataInit.pairingId,
					{
						isPaired: false,
					},
				);
				throw error;
			}
		}

		if (currentAccountAddress && tempAccountAddress == null) {
			await updatePairingObject(data.token, pairingDataInit.pairingId, {
				isPaired: false,
				pairingFailureReason: 'NO_BACKUP_DATA_WHILE_REPAIRING',
			});
		}

		await updatePairingObject(data.token, pairingDataInit.pairingId, {
			isPaired: true,
		});

		const pairingData: PairingData = {
			pairingId: pairingDataInit.pairingId,
			webEncPublicKey: _sodium.to_hex(pairingDataInit.encPair.publicKey),
			webEncPrivateKey: _sodium.to_hex(
				pairingDataInit.encPair.privateKey,
			),
			webSignPublicKey: _sodium.to_hex(
				pairingDataInit.signPair.publicKey,
			),
			webSignPrivateKey: _sodium.to_hex(
				pairingDataInit.signPair.privateKey,
			),
			appPublicKey: data.appPublicKey,
			token: data.token,
			tokenExpiration: data.tokenExpiration,
			deviceName: data.deviceName,
		};

		return {
			newPairingState: {
				pairingData,
				distributedKey: tempDistributedKey ?? null,
				accountId: tempDistributedKey ? uuid() : null,
			},
			elapsedTime: Date.now() - startTime,
			deviceName: data.deviceName,
		};
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		} else throw new SnapError('unkown-error', SnapErrorCode.UnknownError);
	}
};

export const refreshToken = async (pairingData: PairingData) => {
	try {
		let startTime = Date.now();
		let signature: Uint8Array;
		signature = _sodium.crypto_sign_detached(
			pairingData.token,
			_sodium.from_hex(pairingData.webSignPrivateKey),
		);

		const data = await refreshTokenEndpoint(
			pairingData.token,
			_sodium.to_hex(signature),
		);
		const newPairingData: PairingData = {
			...pairingData,
			...data,
		};
		return {
			newPairingData: newPairingData,
			elapsedTime: Date.now() - startTime,
		};
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		} else throw new SnapError(`unkown-error`, SnapErrorCode.UnknownError);
	}
};
