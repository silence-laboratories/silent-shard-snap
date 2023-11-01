import { deleteStorage, isStorageExist } from './storage';
import * as PairingAction from './actions/pairing';
import * as KeyGenAction from './actions/keygen';
import * as SignAction from './actions/sign';
import * as Backup from './actions/backup';
import { encMessage, requestEntropy } from './entropy';
import { fromHexStringToBytes } from './utils';
import { saveSilentShareStorage, getSilentShareStorage } from './storage';
import { SignMetadata, StorageData } from '../types';
import { SnapError, SnapErrorCode } from '../error';
import { IP1KeyShare } from '@silencelaboratories/ecdsa-tss';
import { v4 as uuid } from 'uuid';

async function isPaired() {
	// let cond = await isStorageExist();
	// if (!cond) {
	// 	return {
	// 		isPaired: false,
	// 		deviceName: null,
	// 	};
	// }
	try {
		let silentShareStorage = await getSilentShareStorage();
		const deviceName = silentShareStorage.pairingData.deviceName;
		return {
			isPaired: true,
			deviceName,
			isAccountExist: !!silentShareStorage.tempDistributedKey,
		};
	} catch {
		return {
			isPaired: false,
			deviceName: null,
		};
	}
}

async function unpair() {
	await deleteStorage();
}

async function initPairing() {
	let qrCode = await PairingAction.init();
	return qrCode;
}

async function runPairing() {
	let result = await PairingAction.getToken();
	await saveSilentShareStorage(result.silentShareStorage);
	return {
		pairingStatus: 'paired',
		deviceName: result.deviceName,
		elapsedTime: result.elapsedTime,
		usedBackupData: result.usedBackupData,
		tempDistributedKey: result.silentShareStorage.tempDistributedKey,
	};
}

async function refreshPairing() {
	let silentShareStorage: StorageData = await getSilentShareStorage();
	let pairingData = silentShareStorage.pairingData;
	let result = await PairingAction.refreshToken(pairingData);
	await saveSilentShareStorage({
		...silentShareStorage,
		pairingData: result.newPairingData,
	});
	return result.newPairingData;
}

async function runKeygen() {
	let silentShareStorage: StorageData = await getSilentShareStorage();
	let pairingData = silentShareStorage.pairingData;
	// Refresh token if it is expired
	if (pairingData.tokenExpiration < Date.now() - 60000) {
		pairingData = await refreshPairing();
	}
	let wallets = silentShareStorage.wallets;
	let accountId = Object.keys(wallets).length + 1;
	let x1 = fromHexStringToBytes(await requestEntropy());
	let result = await KeyGenAction.keygen(pairingData, accountId, x1);
	saveSilentShareStorage({
		...silentShareStorage,
		accountId: uuid(),
		tempDistributedKey: {
			publicKey: result.publicKey,
			accountId,
			keyShareData: result.keyShareData,
		},
	});
	return {
		distributedKey: {
			publicKey: result.publicKey,
			accountId: accountId,
			keyShareData: result.keyShareData,
		},
		elapsedTime: result.elapsedTime,
	};
}

async function runBackup() {
	let silentShareStorage: StorageData = await getSilentShareStorage();
	const encryptedMessage = await encMessage(
		JSON.stringify(silentShareStorage.tempDistributedKey),
	);
	await Backup.backup(silentShareStorage.pairingData, encryptedMessage);
}

async function runSign(
	hashAlg: string,
	message: string,
	messageHashHex: string,
	signMetadata: SignMetadata,
	accountId: number,
	keyShare: IP1KeyShare,
) {
	if (messageHashHex.startsWith('0x')) {
		messageHashHex = messageHashHex.slice(2);
	}
	if (message.startsWith('0x')) {
		message = message.slice(2);
	}
	let silentShareStorage = await getSilentShareStorage();
	let pairingData = silentShareStorage.pairingData;
	if (pairingData.tokenExpiration < Date.now() - 60000) {
		pairingData = await refreshPairing();
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
		keyShare,
		hashAlg,
		message,
		messageHash,
		signMetadata,
		accountId,
	);
}

export {
	initPairing,
	runPairing,
	runKeygen,
	runSign,
	runBackup,
	unpair,
	isPaired,
	refreshPairing,
};
