import { SnapError, SnapErrorCode } from './error';

const baseUrl = 'https://us-central1-mobile-wallet-mm-snap.cloudfunctions.net';
// const baseUrl = 'http://127.0.0.1:5001/mobile-wallet-mm-snap/us-central1';

interface Response {
	response: any;
	error: string;
}

const modifiedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
	return await fetch(input, init)
		.then(async (data) => {
			const temp: Response = await data.json();
			if (temp.error) {
				throw new SnapError(temp.error, SnapErrorCode.FirebaseError);
			} else return temp.response;
		})
		.catch((error) => {
			if (error instanceof SnapError) {
				throw error;
			}
			if (error instanceof Error) {
				throw new SnapError(error.message, SnapErrorCode.FirebaseError);
			} else
				throw new SnapError(
					`unkown-error`,
					SnapErrorCode.FirebaseError,
				);
		});
};

export const getTokenEndpoint = async (
	pairing_id: string,
	signature: string,
) => {
	const url = baseUrl + `/getToken`;
	const data: {
		token: string;
		app_public_key: string;
		device_name: string;
		token_expiration: number;
		backup_data?: string;
	} = await modifiedFetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ pairing_id, signature }),
	});
	return data;
};

export const refreshTokenEndpoint = async (
	token: string,
	signed_token: string,
) => {
	const url = baseUrl + `/refreshToken`;
	const data: {
		token: string;
		token_expiration: number;
	} = await modifiedFetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			signed_token,
		}),
	});
	return data;
};

export const sendMessage = async <T>(
	token: string,
	type: 'keygen' | 'sign' | 'pairing' | 'backup',
	conversation: T | null,
	expectResponse: boolean,
	docId?: string,
) => {
	const url = baseUrl + `/sendMessage`;
	const data: T | null = await modifiedFetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			collection: type,
			data: conversation,
			expectResponse,
			docId
		}),
	});
	return data;
};
