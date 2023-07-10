import { deleteStorage, isStorageExist } from './storage';
import * as PairingAction from './actions/pairing';
import * as KeyGenAction from './actions/keygen';
import * as SignAction from './actions/sign';
import * as Backup from './actions/backup';
import { requestEntropy } from './entropy';
import { fromHexStringToBytes } from './utils';
import { saveSilentShareStorage, getSilentShareStorage } from './storage';
import { StorageData } from '../types';
import { SnapError, SnapErrorCode } from '../error';

async function isPaired() {
	let cond = await isStorageExist();
	if (!cond) {
		return {
			is_paired: false,
			device_name: null,
		};
	}
	let silentShareStorage = await getSilentShareStorage();
	const deviceName = silentShareStorage.pairing_data.device_name;
	return {
		is_paired: true,
		device_name: deviceName,
	};
}

async function unpair() {
	await deleteStorage();
}

async function getAccountsInfo() {
	let silentShareStorage = await getSilentShareStorage();
	let accountsInfo:string[] = [];
	silentShareStorage.distributed_keys.forEach((dk) => {
		accountsInfo.push(dk.public_key);
	});
	return accountsInfo;
}

async function initPairing() {
	let storageExist = await isStorageExist();
	if (storageExist) {
		throw new SnapError('Already paired', SnapErrorCode.AlreadyPaired);
	}
	let qrCode = await PairingAction.init();
	return qrCode;
}

async function runPairing() {
	let result = await PairingAction.getToken();
	await saveSilentShareStorage(result.silentShareStorage);
	return {
		pairing_status: 'paired',
		device_name: result.deviceName,
		elapsed_time: result.elapsedTime,
		used_backup_data: result.usedBackupData,
	};
}

async function refreshPairing() {
	let silentShareStorage: StorageData = await getSilentShareStorage();
	let pairingData = silentShareStorage.pairing_data;
	let result = await PairingAction.refreshToken(pairingData);
	await saveSilentShareStorage({
		...silentShareStorage,
		pairing_data: result.newPairingData,
	});
	return result.newPairingData;
}

async function runKeygen() {
	let silentShareStorage: StorageData = await getSilentShareStorage();
	let pairingData = silentShareStorage.pairing_data;
	// Refresh token if it is expired
	if (pairingData.token_expiration < Date.now() - 60000) {
		pairingData = await refreshPairing();
	}

	let distributedKeys = silentShareStorage.distributed_keys;
	let accountId = distributedKeys.length + 1;
	let x1 = fromHexStringToBytes(await requestEntropy());
	let result = await KeyGenAction.keygen(pairingData, accountId, x1);
	distributedKeys.push({
		account_id: accountId,
		key_share_data: result.keyShareData,
		public_key: result.public_key,
	});
	await saveSilentShareStorage({
		...silentShareStorage,
		distributed_keys: distributedKeys,
	});
	return {
		public_key: result.public_key,
		elapsed_time: result.elapsed_time,
	};
}

async function runBackup() {
	let silentShareStorage: StorageData = await getSilentShareStorage();
	await Backup.backup(silentShareStorage.pairing_data,silentShareStorage.distributed_keys);
}

async function runSign(
	publicKey: string,
	hashAlg: string,
	message: string,
	messageHashHex: string,
	sign_metadata: 'eth_transaction' | 'eth_sign',
) {
	let silentShareStorage = await getSilentShareStorage();
	let pairingData = silentShareStorage.pairing_data;
	if (pairingData.token_expiration < Date.now() - 60000) {
		pairingData = await refreshPairing();
	}
	let distributedKey = silentShareStorage.distributed_keys.find(
		(dk) => dk.public_key === publicKey,
	);
	if (!distributedKey) {
		throw new SnapError(
			`No distributed key found for ${publicKey}`,
			SnapErrorCode.NoDistributedKeyFound,
		);
	}
	let messageHash = fromHexStringToBytes(messageHashHex);
	if (messageHash.length !== 32) {
		throw new SnapError(
			'Invalid length of messageHash, should be 32 bytes',
			SnapErrorCode.InvalidMessageHashLength,
		);
	}

	return await SignAction.sign(
		pairingData,
		distributedKey,
		hashAlg,
		message,
		messageHash,
		sign_metadata,
	);
}

export {
	getAccountsInfo,
	initPairing,
	runPairing,
	runKeygen,
	runSign,
	runBackup,
	unpair,
	isPaired,
	refreshPairing,
};
