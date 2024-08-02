// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import HttpClient from '../transport/httpClient';
import { SnapError, SnapErrorCode } from '../error';

export class UserAction {
	#httpClient: HttpClient;

	constructor(httpClient: HttpClient) {
		this.#httpClient = httpClient;
	}

	setSnapVersion = async (token: string, snapVersion: string) => {
		try {
			await this.#httpClient.sendMessage(token, 'users', { snapVersion }, false);
		} catch (error) {
			if (error instanceof SnapError) {
				throw error;
			} else if (error instanceof Error) {
				throw new SnapError(error.message, SnapErrorCode.BackupFailed);
			} else throw new SnapError('unknown-error', SnapErrorCode.UnknownError);
		}
	};
}
