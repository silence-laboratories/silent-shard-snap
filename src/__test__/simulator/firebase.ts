import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase.json';
import 'dotenv/config';

const app = initializeApp({
	...firebaseConfig,
	apiKey: process.env.API_KEY!,
	appId: process.env.API_ID!,
});

export const auth = getAuth(app);

export const signInFirebase = async () => {
	return await signInAnonymously(auth);
};

export const removeUser = async () => {
	const user = auth.currentUser;
	if (user) {
		await user.delete();
	}
};

export const db = getFirestore(app);
