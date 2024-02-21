// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import { SnapError, SnapErrorCode } from '../error';
import { JsonTx } from '@ethereumjs/tx';
import type { Json } from '@metamask/utils';
import { randBytes } from '@silencelaboratories/ecdsa-tss';
import _sodium from 'libsodium-wrappers';

export const fromHexStringToBytes = (hexString: string) => {
	try {
		const matched = hexString.match(/.{1,2}/g);
		if (matched) {
			return Uint8Array.from(matched.map((byte) => parseInt(byte, 16)));
		} else {
			throw new Error(`invalid-hex-string`);
		}
	} catch (error) {
		throw error instanceof Error
			? error
			: new SnapError(`unknown-error`, SnapErrorCode.UnknownError);
	}
};

export const toHexString = (bytes: Uint8Array) => {
	try {
		return bytes.reduce(
			(str, byte) => str + byte.toString(16).padStart(2, '0'),
			'',
		);
	} catch (error) {
		throw error instanceof Error
			? error
			: new SnapError(`unknown-error`, SnapErrorCode.UnknownError);
	}
};

export function checkOwnKeys(keys: string[], object: object) {
	return keys.every(function (key) {
		return object.hasOwnProperty(key);
	});
}

export async function randomString(n: number): Promise<string> {
	// A n length string taking characters from lower_case, upper_case and digits
	var result = '';
	const characters =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
	await _sodium.ready;
	for (var i = 0; i < n; i++) {
		result += characters[_sodium.randombytes_uniform(characters.length)];
	}
	return result;
}

export function randomPairingId(): Promise<string> {
	return randomString(19);
}

// Will give a pause of 'ms' milliseconds in an async block. Always call with await
export function delay(ms: number) {
	return new Promise((_) => setTimeout(_, ms));
}

export function uint8ArrayToUtf8String(array: Uint8Array): string {
	const decoder = new TextDecoder('utf-8');
	return decoder.decode(array);
}

export function Uint8ArrayTob64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64');
}

export function b64ToUint8Array(str: string): Uint8Array {
	return Uint8Array.from(Buffer.from(str, 'base64'));
}

export function b64ToString(str: string): string {
	return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Serializes a transaction by removing undefined properties and converting them to null.
 *
 * @param tx - The transaction object.
 * @param type - The type of the transaction.
 * @returns The serialized transaction.
 */
export function serializeTransaction(tx: JsonTx, type: number): Json {
	const serializableSignedTx: Record<string, any> = {
		...tx,
		type,
	};
	// Make tx serializable
	// toJSON does not remove undefined or convert undefined to null
	Object.entries(serializableSignedTx).forEach(([key, _]) => {
		if (serializableSignedTx[key] === undefined) {
			delete serializableSignedTx[key];
		}
	});

	return serializableSignedTx;
}

/**
 * Determines whether the given CAIP-2 chain ID represents an EVM-based chain.
 *
 * @param caip2ChainId - The CAIP-2 chain ID to check.
 * @returns Returns true if the chain is EVM-based, otherwise false.
 */
export function isEvmChain(caip2ChainId: string): boolean {
	return caip2ChainId.startsWith('eip155:');
}
