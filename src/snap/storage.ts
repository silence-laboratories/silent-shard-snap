import { StorageData } from '../types';
import { SnapError, SnapErrorCode } from '../error';

const STORAGE_KEY = 'SilentShare1';

/**
 * Function to check if a storage exist
 *
 * @returns true if exists, false otherwise
 */
const isStorageExist = async (): Promise<boolean> => {
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
};

/**
 * Delete the stored data, if it exists.
 */
const deleteStorage = async () => {
	await snap.request({
		method: 'snap_manageState',
		params: { operation: 'clear' },
	});
};

/**
 * Save SilentShareStorage
 *
 * @param data obj to save
 */
const saveSilentShareStorage = async (data: StorageData) => {
	try {
		if (data == null) {
			throw new SnapError(
				'Storage data cannot be null',
				SnapErrorCode.InvalidStorageData,
			);
		}

		let state: {
			SilentShare1?: string;
		} = {};
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
};

/**
 * Retrieve SilentShareStorage
 *
 * @returns SilentShareStorage object
 */
const getSilentShareStorage = async (): Promise<StorageData> => {
	try {
		const _isStorageExist = await isStorageExist();
		if (!_isStorageExist) {
			throw new SnapError('Snap is not paired', SnapErrorCode.NotPaired);
		}

		let state = await snap.request({
			method: 'snap_manageState',
			params: { operation: 'get' },
		});

		if (!state) {
			throw new SnapError(
				'Snap failed to fetch state',
				SnapErrorCode.UnknownError,
			);
		}

		const jsonObject: StorageData = JSON.parse(
			state[STORAGE_KEY] as string,
		);

		return jsonObject;
	} catch (error) {
		throw error instanceof Error
			? new SnapError(error.message, SnapErrorCode.StorageError)
			: new SnapError(`unknown-error`, SnapErrorCode.UnknownError);
	}
};

export {
	isStorageExist,
	deleteStorage,
	saveSilentShareStorage,
	getSilentShareStorage,
};
