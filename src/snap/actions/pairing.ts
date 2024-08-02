// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import * as utils from '../utils/utils';
import * as Entropy from '../entropy';
import { v4 as uuid } from 'uuid';
import _sodium from 'libsodium-wrappers';
import HttpClient from '../transport/httpClient';
import { SnapError, SnapErrorCode } from '../error';
import { PairingDataInit, DistributedKey, PairingData } from '../types';

export enum PairingRemark {
	WALLET_MISMATCH = 'WALLET_MISMATCH',
	NO_BACKUP_DATA_WHILE_REPAIRING = 'NO_BACKUP_DATA_WHILE_REPAIRING',
	INVALID_BACKUP_DATA = 'INVALID_BACKUP_DATA',
}

export class PairingAction {
	#httpClient: HttpClient;
	#pairingDataInit?: PairingDataInit;

	constructor(httpClient: HttpClient) {
		this.#httpClient = httpClient;
	}

	init = async () => {
		try {
			await _sodium.ready;

			const pairingId = await utils.randomPairingId();
			const encPair = _sodium.crypto_box_keypair();
			const signPair = _sodium.crypto_sign_keypair();

			this.#pairingDataInit = {
				pairingId,
				encPair,
				signPair,
			};

			const qrCode = JSON.stringify({
				pairingId,
				webEncPublicKey: _sodium.to_hex(encPair.publicKey),
				signPublicKey: _sodium.to_hex(signPair.publicKey),
			});

			return qrCode;
		} catch (error) {
			if (error instanceof Error) {
				throw new SnapError(error.message, SnapErrorCode.UnknownError);
			} else throw new SnapError('unkown-error', SnapErrorCode.UnknownError);
		}
	};

	#sendPairingFirebaseDoc = async (
		token: string,
		pairingId: string,
		pairingObject:
			| { isPaired: boolean }
			| {
				isPaired: boolean;
				pairingRemark: string;
			},
	) => {
		await this.#httpClient.sendMessage(token, 'pairing', pairingObject, false, pairingId);
	};

	#decryptAndDeserializeBackupData = async (
		token: string,
		backupData: string,
	): Promise<{ distributedKey: DistributedKey; accountAddress: string }> => {
		try {
			const decreptedMessage = await Entropy.decMessage(backupData);
			const distributedKey = JSON.parse(
				utils.uint8ArrayToUtf8String(decreptedMessage),
			);
			let accountAddress = utils.getAddressFromDistributedKey(distributedKey);
			return {
				distributedKey,
				accountAddress,
			};
		} catch (error) {
			await this.#sendPairingFirebaseDoc(token, this.#pairingDataInit!.pairingId, {
				isPaired: false,
				pairingRemark: PairingRemark.INVALID_BACKUP_DATA,
			});
			if (error instanceof SnapError) {
				throw error;
			} else if (error instanceof Error) {
				throw new SnapError(error.message, SnapErrorCode.InvalidBackupData);
			} else
				throw new SnapError(
					'wrong secret key for the given ciphertext',
					SnapErrorCode.InvalidBackupData,
				);
		}
	};

	#validatePairingAccount = async (
		sessionToken: string,
		pairingId: string,
		accountAddress?: string,
		currentAccountAddress?: string,
	) => {
		if (currentAccountAddress && accountAddress == null) {
			await this.#sendPairingFirebaseDoc(sessionToken, pairingId, {
				isPaired: false,
				pairingRemark: PairingRemark.NO_BACKUP_DATA_WHILE_REPAIRING,
			});
		} else if (
			currentAccountAddress &&
			accountAddress &&
			currentAccountAddress !== accountAddress
		) {
			await this.#sendPairingFirebaseDoc(sessionToken, pairingId, {
				isPaired: true,
				pairingRemark: PairingRemark.WALLET_MISMATCH,
			});
		} else
			await this.#sendPairingFirebaseDoc(sessionToken, pairingId, {
				isPaired: true,
			});
	};

	getPairingSessionData = async (currentAccountAddress?: string) => {
		try {
			if (!this.#pairingDataInit) {
				throw new SnapError(
					'Pairing data not initialized',
					SnapErrorCode.PairingNotInitialized,
				);
			}

			const startTime = Date.now();
			const pairingId = this.#pairingDataInit.pairingId;
			const signature = _sodium.crypto_sign_detached(
				pairingId,
				this.#pairingDataInit.signPair.privateKey,
			);

			const pairingResponse = await this.#httpClient.getTokenEndpoint(
				pairingId,
				_sodium.to_hex(signature),
			);
			const sessionToken = pairingResponse.token;

			let distributedKey: DistributedKey | undefined;
			let accountAddress: string | undefined;
			if (pairingResponse.backupData) {
				const backupDataJson = await this.#decryptAndDeserializeBackupData(
					sessionToken,
					pairingResponse.backupData,
				);
				distributedKey = backupDataJson.distributedKey;
				accountAddress = backupDataJson.accountAddress;
			}

			await this.#validatePairingAccount(
				sessionToken,
				pairingId,
				accountAddress,
				currentAccountAddress,
			);

			const pairingData: PairingData = {
				pairingId: pairingId,
				webEncPublicKey: _sodium.to_hex(this.#pairingDataInit.encPair.publicKey),
				webEncPrivateKey: _sodium.to_hex(
					this.#pairingDataInit.encPair.privateKey,
				),
				webSignPublicKey: _sodium.to_hex(
					this.#pairingDataInit.signPair.publicKey,
				),
				webSignPrivateKey: _sodium.to_hex(
					this.#pairingDataInit.signPair.privateKey,
				),
				appPublicKey: pairingResponse.appPublicKey,
				token: sessionToken,
				tokenExpiration: pairingResponse.tokenExpiration,
				deviceName: pairingResponse.deviceName,
			};
			return {
				newPairingState: {
					pairingData,
					distributedKey: distributedKey ?? null,
					accountId: distributedKey ? uuid() : null,
				},
				elapsedTime: Date.now() - startTime,
				deviceName: pairingResponse.deviceName,
			};
		} catch (error) {
			if (error instanceof Error) {
				throw error;
			} else throw new SnapError('unkown-error', SnapErrorCode.UnknownError);
		}
	};

	refreshToken = async (pairingData: PairingData) => {
		try {
			const startTime = Date.now();
			const signature = _sodium.crypto_sign_detached(
				pairingData.token,
				_sodium.from_hex(pairingData.webSignPrivateKey),
			);

			const data = await this.#httpClient.refreshTokenEndpoint(
				pairingData.token,
				_sodium.to_hex(signature),
			);
			const newPairingData: PairingData = {
				...pairingData,
				...data,
			};
			return {
				newPairingData: newPairingData,
				elapsedTime: Date.now() - startTime,
			};
		} catch (error) {
			if (error instanceof Error) {
				throw error;
			} else throw new SnapError(`unkown-error`, SnapErrorCode.UnknownError);
		}
	};
}