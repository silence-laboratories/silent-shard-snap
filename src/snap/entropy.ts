import { SnapError, SnapErrorCode } from '../error';
import { toHexString } from './utils';
import _sodium from 'libsodium-wrappers';

export const requestEntropy = async (salt?: Uint8Array) => {
	const hexSalt = salt ?? crypto.getRandomValues(new Uint8Array(32));
	const entropy = (await snap.request({
		method: 'snap_getEntropy',
		params: {
			version: 1,
			salt: hexSalt.toString(),
		},
	})) as string;

	return entropy.slice(2);
};

export const encMessage = async (message: string) => {
	const salt = crypto.getRandomValues(new Uint8Array(32));
	const nonce = _sodium.randombytes_buf(_sodium.crypto_secretbox_NONCEBYTES);
	const entropyHex = await requestEntropy(salt);
	const encKey = _sodium
		.from_hex(entropyHex)
		.subarray(0, _sodium.crypto_secretbox_KEYBYTES);
	return `${_sodium.to_hex(salt)}.${_sodium.to_hex(
		nonce,
	)}.${_sodium.crypto_secretbox_easy(message, nonce, encKey, 'base64')}`;
};

export const decMessage = async (cipherText: string): Promise<Uint8Array> => {
	const array = cipherText.split('.');
	if (array.length !== 3) {
		throw new SnapError(
			'Invalid backup data',
			SnapErrorCode.InvalidBackupData,
		);
	}
	const salt = _sodium.from_hex(array[0]!);
	const entropyHex = await requestEntropy(salt);
	const encKey = _sodium
		.from_hex(entropyHex)
		.subarray(0, _sodium.crypto_secretbox_KEYBYTES);
	const nonce = _sodium.from_hex(array[1]!);
	const cipherMessage = _sodium.from_base64(array[2]!);
	return _sodium.crypto_secretbox_open_easy(cipherMessage, nonce, encKey);
};
