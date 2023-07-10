import * as passworder from '@metamask/browser-passworder';
import { StorageData } from '../types';
import { SnapError, SnapErrorCode } from '../error';

const STORAGE_KEY = 'SilentShare1';

/**
 * Function to check if a storage exist
 *
 * @returns true if exists, false otherwise
 */
async function isStorageExist(): Promise<boolean> {
	try {
		let data = await snap.request({
			method: 'snap_manageState',
			params: { operation: 'get' },
		});
		return data !== null;
	} catch (error) {
		throw error instanceof Error
			? new SnapError(error.message, SnapErrorCode.StorageError)
			: new SnapError(`unknown-error`, SnapErrorCode.UnknownError);
	}
}

/**
 * Delete the stored data, if it exists.
 */
async function deleteStorage() {
	await snap.request({
		method: 'snap_manageState',
		params: { operation: 'clear' },
	});
}

/**
 * Save SilentShareStorage
 *
 * @param data obj to save
 */
async function saveSilentShareStorage(data: StorageData) {
	try {
		if (data == null) {
			throw new SnapError(
				'Storage data cannot be null',
				SnapErrorCode.InvalidData,
			);
		}

		// const encryptionKey = await getEncryptionKey();
		// let encryptedStr = await passworder.encrypt(
		// 	encryptionKey,
		// 	JSON.stringify(data),
		// );

		let state = {};
		state[STORAGE_KEY] = JSON.stringify(data);

		await snap.request({
			method: 'snap_manageState',
			params: { operation: 'update', newState: state },
		});
	} catch (error) {
		throw error instanceof Error
			? new SnapError(error.message, SnapErrorCode.StorageError)
			: new SnapError(`unknown-error`, SnapErrorCode.UnknownError);
	}
}

/**
 * Retrieve SilentShareStorage
 *
 * @returns SilentShareStorage object
 */
async function getSilentShareStorage() {
	try {
		if (!(await isStorageExist())) {
			throw new SnapError(
				'Wallet not created yet',
				SnapErrorCode.WalletNotCreated,
			);
		}

		let state = await snap.request({
			method: 'snap_manageState',
			params: { operation: 'get' },
		});

		// const encryptionKey = await getEncryptionKey();

		// const decryptedStr: string = (await passworder.decrypt(
		// 	encryptionKey,
		// 	state[STORAGE_KEY] as string,
		// )) as unknown as string;
		const jsonObject: StorageData = JSON.parse(
			state[STORAGE_KEY] as string,
		);
		return jsonObject;
	} catch (error) {
		throw error instanceof Error
			? new SnapError(error.message, SnapErrorCode.StorageError)
			: new SnapError(`unknown-error`, SnapErrorCode.UnknownError);
	}
}

export {
	isStorageExist,
	deleteStorage,
	saveSilentShareStorage,
	getSilentShareStorage,
};
