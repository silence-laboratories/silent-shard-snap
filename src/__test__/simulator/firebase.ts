import { initializeApp } from 'firebase/app';
import {
	getAuth,
    signInAnonymously,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase.json';

const app = initializeApp(firebaseConfig);

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
