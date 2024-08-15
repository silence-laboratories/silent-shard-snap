import _sodium from 'libsodium-wrappers';
import { Firebase } from './firebase';
import { SimulatorSdk } from './sdk';

export class Simulator {
	#simulatorId: string = `simulator-${Math.floor(Math.random() * 1000000)}`;
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
			await this.firebase.signInFirebase();
			// TODO: Right now, we're using random UUID for testing only. 
			// In the future, we want to control these IDs. By using anonymous sign-in, then delete the users after the test.
			this.sdk = new SimulatorSdk(this.#simulatorId, this.firebase.db);
		} catch (error) {
			console.error("signIn sim err", error);
		}
	};

	changeSimulatorId = () => {
		this.#simulatorId = `simulator-${Math.floor(Math.random() * 1000000)}`;
	}

	pairing = (qrCode: QrCode, isRepair = false) => {
		try {
			const sdk = this.getSdk();
			return sdk.pairing(qrCode, isRepair);
		} catch (error) {
			console.error("pairing sim err", error);
		}
	};

	keygen = () => {
		try {
			const sdk = this.getSdk();
			return sdk.keygen();
		} catch (error) {
			throw Error("keygen sim err");
		}
	};

	sign = () => {
		try {
			const sdk = this.getSdk();
			return sdk.sign();
		} catch (error) {
			throw Error('"sign sim err"');
		}
	}

	backup = () => {
		const sdk = this.getSdk();
		return sdk.backup();
	}

	getWalletAddress = () => {
		const sdk = this.getSdk();
		return sdk.getWalletAddress();
	}

	cleanUpSimulation = async () => {
		try {
			await this.firebase.removeUser();
			this.sdk = null;
		} catch (error) {
			console.error("cleanUpSimulation sim err", error);
		}
	};

}