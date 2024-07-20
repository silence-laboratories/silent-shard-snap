import _sodium from 'libsodium-wrappers';
import { Firebase } from './firebase';
import { SimulatorSdk } from './sdk';

export class Simulator {
	sdk: SimulatorSdk | null = null;
	firebase: Firebase;

	constructor() {
		this.firebase = Firebase.instance();
	}

	static async init() {
		await SimulatorSdk.init();
	}

	getSdk = () => {
		if (this.sdk == null) {
			throw new Error('Do signin before using sdk');
		}
		return this.sdk;
	}

	signIn = async () => {
		try {
			const data = await this.firebase.signInFirebase();
			this.sdk = new SimulatorSdk(data.user.uid, this.firebase.db);
		} catch (error) {
			console.error("signIn sim err", error);
		}
	};

	pairing = async (qrCode: QrCode, isRepair = false) => {
		try {
			const sdk = this.getSdk();
			await sdk.pairing(qrCode, isRepair);
		} catch (error) {
			console.error("pairing sim err", error);
		}
	};

	keygen = async () => {
		try {
			const sdk = this.getSdk();
			await sdk.keygen();
		} catch (error) {
			console.error("keygen sim err", error);
		}
	};

	sign = async () => {
		try {
			const sdk = this.getSdk();
			return await sdk.sign();
		} catch (error) {
			console.error("sign sim err", error);
		}
	}

	backup = async () => {
		const sdk = this.getSdk();
		await sdk.backup();
	}

	cleanUpSimulation = async () => {
		try {
			await this.firebase.removeUser();
			this.sdk = null;
			console.log("cleanUpSimulation sim done");
		} catch (error) {
			console.error("cleanUpSimulation sim err", error);
		}
	};

}