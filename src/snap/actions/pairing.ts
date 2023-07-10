import * as utils from '../utils';
import {
	getTokenEndpoint,
	refreshTokenEndpoint,
	sendMessage,
} from '../../firebaseEndpoints';
import _sodium from 'libsodium-wrappers';
import { DistributedKey, PairingData, StorageData } from '../../types';
import { SnapError, SnapErrorCode } from '../../error';
import { decMessage } from '../entropy';
let running = false;

export interface PairingDataInit {
	pairing_id: string;
	encPair: _sodium.KeyPair;
	signPair: _sodium.KeyPair;
}

let pairingDataInit: PairingDataInit;

export const init = async () => {
	try {
		let pairing_id = utils.random_pairing_id();

		await _sodium.ready;
		const encPair = _sodium.crypto_box_keypair();
		const signPair = _sodium.crypto_sign_keypair();

		pairingDataInit = {
			pairing_id,
			encPair,
			signPair,
		};

		let qrCode = JSON.stringify({
			pairing_id,
			web_enc_public_key: _sodium.to_hex(encPair.publicKey),
			sign_public_key: _sodium.to_hex(signPair.publicKey),
		});

		return qrCode;
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		} else throw new SnapError('unkown-error', SnapErrorCode.UnknownError);
	}
};

export const getToken = async () => {
	try {
		if (running)
			throw new SnapError(
				'Pairing is already running',
				SnapErrorCode.ResourceBusy,
			);

		if (!pairingDataInit) {
			throw new SnapError(
				'Pairing data not initialized',
				SnapErrorCode.PairingNotInitialized,
			);
		}
		running = true;

		let startTime = Date.now();

		const signature = _sodium.crypto_sign_detached(
			pairingDataInit.pairing_id,
			pairingDataInit.signPair.privateKey,
		);

		const data = await getTokenEndpoint(
			pairingDataInit.pairing_id,
			_sodium.to_hex(signature),
		);
		let distributed_keys = [];
		let usedBackupData = false;
		if (data.backup_data) {
			try {
				const decreptedMessage =  await decMessage(data.backup_data);
				distributed_keys = JSON.parse(utils.uint8ArrayToUtf8String(decreptedMessage)) as DistributedKey[];
				await sendMessage(data.token, 'pairing', { is_paired: true }, false, pairingDataInit.pairing_id);
				usedBackupData = true;
			}catch (error){
				await sendMessage(data.token, 'pairing', { is_paired: false }, false, pairingDataInit.pairing_id);
				if(error instanceof SnapError) {
					throw error;
				} else if(error instanceof Error) {
					throw new SnapError(error.message,SnapErrorCode.InvalidBackupData);
				} else 
				throw new SnapError('unknown-error',SnapErrorCode.UnknownError)
			}
		} else {
			await sendMessage(data.token, 'pairing', { is_paired: true }, false, pairingDataInit.pairing_id);
		} 
		const pairing_data: PairingData = {
			pairing_id: pairingDataInit.pairing_id,
			web_enc_public_key: _sodium.to_hex(
				pairingDataInit.encPair.publicKey,
			),
			web_enc_private_key: _sodium.to_hex(
				pairingDataInit.encPair.privateKey,
			),
			web_sign_public_key: _sodium.to_hex(
				pairingDataInit.signPair.publicKey,
			),
			web_sign_private_key: _sodium.to_hex(
				pairingDataInit.signPair.privateKey,
			),
			app_public_key: data.app_public_key,
			token: data.token,
			token_expiration: data.token_expiration,
			device_name: data.device_name,
		};
		running = false;
		return {
			silentShareStorage: {
				pairing_data,
				distributed_keys,
			},
			elapsedTime: Date.now() - startTime,
			deviceName: data.device_name,
			usedBackupData
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
			_sodium.from_hex(pairingData.web_sign_private_key),
		);

		const data = await refreshTokenEndpoint(
			pairingData.token,
			_sodium.to_hex(signature),
		);
		const newPairingData: PairingData = {
			...pairingData,
			...data,
		};
		running = false;
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
