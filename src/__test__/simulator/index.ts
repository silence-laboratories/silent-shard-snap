import _sodium from 'libsodium-wrappers';
import { removeUser, signInFirebase } from './firebase';
import { sdk } from './sdk';

export const signIn = async () => {
	try {
		await _sodium.ready;
		const data = await signInFirebase();
		sdk.setUid(data.user.uid);
	} catch (error) {
		console.error(error);
	}
};

export const cleanUpSimulation = async () => {
	try {
		await removeUser();
	} catch (error) {
		console.error(error);
	}
};

export const pairing = async (qrCode: string, isRepair = false) => {
	try {
		await sdk.sendPairing(qrCode, isRepair);
	} catch (error) {
		console.error(error);
	}
};

export const keygen = async () => {
	try {
		await sdk.keygen();
	} catch (error) {
		console.error(error);
	}
};

export const backup = () => {
	sdk.backup();
}


