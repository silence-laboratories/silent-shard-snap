import { deleteStorage, isStorageExist } from './storage';
import * as PairingAction from './actions/pairing';
import * as KeyGenAction from './actions/keygen';
import * as SignAction from './actions/sign';
import * as Backup from './actions/backup';
import { encMessage, requestEntropy } from './entropy';
import { fromHexStringToBytes, getAddressFromDistributedKey } from './utils';
import { saveSilentShareStorage, getSilentShareStorage } from './storage';
import { SignMetadata, StorageData } from '../types';
import { SnapError, SnapErrorCode } from '../error';
import { IP1KeyShare } from '@silencelaboratories/ecdsa-tss';
import { v4 as uuid } from 'uuid';

const TOKEN_LIFE_TIME = 60000;

async function isPaired() {
	try {
		let silentShareStorage = await getSilentShareStorage();
		const deviceName = silentShareStorage.pairingData.deviceName;
		return {
			isPaired: true,
			deviceName,
			// Avoid chaning this, have some legacy reference
			isAccountExist:
				silentShareStorage.pairingData.pairingId ===
					silentShareStorage.newPairingState?.pairingData
						?.pairingId &&
				silentShareStorage.newPairingState?.distributedKey,
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
	await saveSilentShareStorage({
		newPairingState: result.newPairingState,
		pairingData: result.newPairingState.pairingData,
		wallets: {},
		requests: {},
	});
	const distributedKey = result.newPairingState.distributedKey;
	return {
		pairingStatus: 'paired',
		newAccountAddress: distributedKey
			? getAddressFromDistributedKey(distributedKey)
			: null,
		deviceName: result.deviceName,
		elapsedTime: result.elapsedTime,
	};
}

async function runRePairing() {
	let silentShareStorage: StorageData = await getSilentShareStorage();
	const wallets = Object.values(silentShareStorage.wallets);
	const currentAccount = wallets.length > 0 ? wallets[0] : null;
	if (!currentAccount) {
		throw new SnapError('Not Paired', SnapErrorCode.NotPaired);
	}
	const currentAccountAddress = getAddressFromDistributedKey(
		currentAccount?.distributedKey,
	);
	let result = await PairingAction.getToken(currentAccountAddress);
	await saveSilentShareStorage({
		...silentShareStorage,
		newPairingState: result.newPairingState,
	});
	const distributedKey = result.newPairingState.distributedKey;
	return {
		pairingStatus: 'paired',
		currentAccountAddress: currentAccountAddress
			? [currentAccountAddress]
			: [],
		newAccountAddress: distributedKey
			? getAddressFromDistributedKey(distributedKey)
			: null,
		deviceName: result.deviceName,
		elapsedTime: result.elapsedTime,
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
	if (pairingData.tokenExpiration < Date.now() - TOKEN_LIFE_TIME) {
		pairingData = await refreshPairing();
	}
	let wallets = silentShareStorage.wallets;
	let accountId = Object.keys(wallets).length + 1;
	let x1 = fromHexStringToBytes(await requestEntropy());
	let result = await KeyGenAction.keygen(pairingData, accountId, x1);
	saveSilentShareStorage({
		...silentShareStorage,
		newPairingState: {
			pairingData: null,
			accountId: uuid(),
			distributedKey: {
				publicKey: result.publicKey,
				accountId,
				keyShareData: result.keyShareData,
			},
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
		JSON.stringify(silentShareStorage.newPairingState?.distributedKey),
	);
	let pairingData = silentShareStorage.pairingData;
	if (pairingData.tokenExpiration < Date.now() - TOKEN_LIFE_TIME) {
		pairingData = await refreshPairing();
	}
	await Backup.backup(pairingData, encryptedMessage);
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
	if (pairingData.tokenExpiration < Date.now() - TOKEN_LIFE_TIME) {
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
	runRePairing,
};
