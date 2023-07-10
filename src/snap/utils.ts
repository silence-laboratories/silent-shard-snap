import { SnapError, SnapErrorCode } from '../error';

export const fromHexStringToBytes = (hexString: string) => {
	try {
		return Uint8Array.from(
			hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)),
		);
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

function randomInteger(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function random_string(n): string {
	// A n length string taking characters from lower_case, upper_case and digits
	var result = '';
	var characters =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
	for (var i = 0; i < n; i++) {
		result += characters[Number(randomInteger(0, characters.length - 1))];
	}
	return result;
}

export function random_pairing_id(): string {
	return random_string(19);
}

export function random_session_id(): string {
	return random_string(19);
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
