import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth, signInAnonymously } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase.json';
import 'dotenv/config';

export class Firebase {
	static #instance: Firebase | null = null;
	#app: FirebaseApp;
	#auth: Auth;
	db: Firestore;

	constructor() {
		this.#app = initializeApp({
			...firebaseConfig,
			apiKey: process.env.API_KEY!,
			appId: process.env.API_ID!,
		});
		this.#auth = getAuth(this.#app);
		this.db = getFirestore(this.#app);
	}

	static instance = () => {
		if (this.#instance == null) {
			this.#instance = new Firebase();
		}
		return this.#instance;
	}

	signInFirebase = async () => {
		return await signInAnonymously(this.#auth);
	};

	removeUser = async () => {
		const user = this.#auth.currentUser;
		if (user) {
			await user.delete();
		}
	};
}