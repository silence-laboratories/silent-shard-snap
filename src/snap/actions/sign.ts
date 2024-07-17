// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import {
	IP1KeyShare,
	P1Signature,
	randBytes,
} from '@silencelaboratories/ecdsa-tss';
import _sodium, { base64_variants } from 'libsodium-wrappers';
import HttpClient from '../transport/httpClient';
import * as utils from '../utils/utils';
import { SnapError, SnapErrorCode } from '../error';
import { SignResult, SignConversation, SignMetadata, PairingData } from '../types';

export class SignAction {
	#running: boolean = false;
	#httpClient: HttpClient;

	constructor(httpClient: HttpClient) {
		this.#httpClient = httpClient;
	}

	sign = async (
		pairingData: PairingData,
		keyShare: IP1KeyShare,
		hashAlg: string,
		message: string,
		messageHash: Uint8Array,
		signMetadata: SignMetadata,
		accountId: number,
	): Promise<SignResult> => {
		try {
			if (this.#running) {
				throw new SnapError(
					`Sign already running`,
					SnapErrorCode.SignResourceBusy,
				);
			}
			this.#running = true;
			const startTime = Date.now();
			const sessionId = _sodium.to_hex(await randBytes(32));
			const p1 = new P1Signature(sessionId, messageHash, keyShare);

			let round = 1;
			let signConversation: SignConversation = {
				signMetadata,
				accountId,
				createdAt: Date.now(),
				expiry: 30000,
				message: {
					party: 1,
					round: round,
				},
				sessionId,
				hashAlg: hashAlg,
				publicKey: keyShare.public_key,
				signMessage: message,
				messageHash: utils.toHexString(messageHash),
				isApproved: null,
			};

			let sign = null;
			let recId = null;
			let expectResponse = true;
			await _sodium.ready;
			while (sign === null || recId === null) {
				let decryptedMessage: string | null = null;
				if (
					signConversation.message.message &&
					signConversation.message.nonce
				) {
					decryptedMessage = utils.uint8ArrayToUtf8String(
						_sodium.crypto_box_open_easy(
							utils.b64ToUint8Array(signConversation.message.message),
							_sodium.from_hex(signConversation.message.nonce),
							_sodium.from_hex(pairingData.appPublicKey!),
							_sodium.from_hex(pairingData.webEncPrivateKey!),
						),
					);
				}
				const decodedMessage = decryptedMessage
					? utils.b64ToString(decryptedMessage)
					: null;

				const msg = await p1
					.processMessage(decodedMessage)
					.catch((error) => {
						throw new SnapError(
							`Internal library error: ${error}`,
							SnapErrorCode.InternalLibError,
						);
					});

				if (msg.signature && msg.recid !== undefined) {
					sign = msg.signature;
					recId = msg.recid;
					expectResponse = false;
				}
				const nonce = _sodium.randombytes_buf(
					_sodium.crypto_box_NONCEBYTES,
				);
				const encMessage = utils.Uint8ArrayTob64(
					_sodium.crypto_box_easy(
						_sodium.to_base64(
							msg.msg_to_send,
							base64_variants.ORIGINAL,
						),
						nonce,
						_sodium.from_hex(pairingData.appPublicKey),
						_sodium.from_hex(pairingData.webEncPrivateKey),
					),
				);
				signConversation = {
					...signConversation,
					message: {
						party: 1,
						round,
						message: encMessage,
						nonce: _sodium.to_hex(nonce),
					},
				};
				const signConversationNew = await this.#httpClient.sendMessage<SignConversation>(
					pairingData.token,
					'sign',
					signConversation,
					expectResponse,
				);
				if (expectResponse && signConversationNew) {
					signConversation = signConversationNew;
				}
				if (signConversation.isApproved === false) {
					throw new SnapError(
						`User(phone) rejected sign request`,
						SnapErrorCode.UserPhoneDenied,
					);
				}
				round++;
			}

			this.#running = false;
			return {
				signature: sign,
				recId,
				elapsedTime: Date.now() - startTime,
			};
		} catch (error) {
			if (error instanceof SnapError) {
				if (error.code != SnapErrorCode.SignResourceBusy) {
					this.#running = false;
				}
				throw error;
			} else if (error instanceof Error) {
				throw new SnapError(error.message, SnapErrorCode.KeygenFailed);
			} else throw new SnapError('unknown-error', SnapErrorCode.SignFailed);
		}
	};
}