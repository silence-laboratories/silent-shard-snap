import _sodium from 'libsodium-wrappers';
import { removeUser, signInFirebase } from './firebase';
import { sdk } from './sdk';

export const signIn = async () => {
	try {
		await _sodium.ready;
		const data = await signInFirebase();
		sdk.setUid(data.user.uid);
	} catch (error) {
		console.error("signIn sim err", error);
	}
};

export const cleanUpSimulation = async () => {
	try {
		await removeUser();
		sdk.cleanState();
		console.log("cleanUpSimulation sim done");
	} catch (error) {
		console.error("cleanUpSimulation sim err", error);
	}
};

export const pairing = async (qrCode: string, isRepair = false) => {
	try {
		await sdk.sendPairing(qrCode, isRepair);
	} catch (error) {
		console.error("pairing sim err", error);
	}
};

export const keygen = async () => {
	try {
		await sdk.keygen();
	} catch (error) {
		console.error("keygen sim err", error);
	}
};

export const sign = async () => {
	try {
		await sdk.sign();
	} catch (error) {
		console.error("sign sim err",error);
	}
}

export const backup = () => {
	sdk.backup();
}


