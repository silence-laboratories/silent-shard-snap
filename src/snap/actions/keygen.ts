// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

// import {
// 	P1Keygen,
// 	P1KeyshareV2,
// 	generatePartyKeys,
// } from '@silencelaboratories/two-party-ecdsa-js';

import {
	IP1KeyShare,
	P1KeyGen,
	randBytes,
} from '@silencelaboratories/ecdsa-tss';

import * as utils from '../utils';
import { KeygenConversation, PairingData } from '../../types';
import { sendMessage } from '../../firebaseApi';
import _sodium, { base64_variants } from 'libsodium-wrappers';
import { SnapError, SnapErrorCode } from '../../error';

let running = false;

type KeygenResult = {
	publicKey: string;
	// keyShareData: P1KeyshareV2;
	keyShareData: IP1KeyShare;
	elapsedTime: number;
};

export const keygen = async (
	pairingData: PairingData,
	accountIdNumber: number,
	x1: Uint8Array,
): Promise<KeygenResult> => {
	try {
		if (running) {
			throw new SnapError(
				`Keygen already running`,
				SnapErrorCode.KeygenResourceBusy,
			);
		}
		running = true;

		const startTime = Date.now();
		const accountId = accountIdNumber;

		const sessionId = _sodium.to_hex(await randBytes(32));
		const p1 = new P1KeyGen(sessionId, x1);
		await p1.init();

		// const keys = await generatePartyKeys();
		// const p1 = await P1Keygen.init(keys);

		let round = 1;

		let keygenConversation: KeygenConversation = {
			accountId,
			createdAt: Date.now(),
			expiry: 30000,
			message: {
				party: 1,
				round,
			},
			isApproved: null,
			sessionId,
		};

		let keyshare: IP1KeyShare | null = null;
		// let keyshare: P1KeyshareV2 | null = null;

		let expectResponse = true;
		await _sodium.ready;
		while (keyshare === null) {
			let decryptedMessage: string | null = null;
			if (
				keygenConversation.message.message &&
				keygenConversation.message.nonce
			) {
				decryptedMessage = utils.uint8ArrayToUtf8String(
					_sodium.crypto_box_open_easy(
						utils.b64ToUint8Array(
							keygenConversation.message.message,
						),
						_sodium.from_hex(keygenConversation.message.nonce),
						_sodium.from_hex(pairingData.appPublicKey!),
						_sodium.from_hex(pairingData.webEncPrivateKey!),
					),
				);
			}

			// let msg;
			// if (!decryptedMessage) {
			// 	msg = await p1.genMsg1().catch((error) => {
			// 		throw new SnapError(
			// 			`Internal library error: ${error}`,
			// 			SnapErrorCode.InternalLibError,
			// 		);
			// 	});
			// } else {
			// 	const decodedMessage = utils.b64ToString(decryptedMessage)
			// 	const keygenMsg2 = JSON.parse(decodedMessage);
			// 	const [p1Keyshare, round2Msg] = await p1.processMsg2(keygenMsg2).catch((error) => {
			// 		throw new SnapError(
			// 			`Internal library error: ${error}`,
			// 			SnapErrorCode.InternalLibError,
			// 		);
			// 	})
			// 	msg = round2Msg;
			// 	if (p1Keyshare) {
			// 		keyshare = p1Keyshare;
			// 		expectResponse = false;
			// 	}
			// }

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
			if (msg.p1_key_share) {
				keyshare = msg.p1_key_share;
				expectResponse = false;
			}

			const nonce = _sodium.randombytes_buf(
				_sodium.crypto_box_NONCEBYTES,
			);
			const encMessage = utils.Uint8ArrayTob64(
				_sodium.crypto_box_easy(
					_sodium.to_base64(
						msg.msg_to_send,
						// JSON.stringify(msg),
						base64_variants.ORIGINAL,
					),
					nonce,
					_sodium.from_hex(pairingData.appPublicKey),
					_sodium.from_hex(pairingData.webEncPrivateKey),
				),
			);
			keygenConversation = {
				...keygenConversation,
				message: {
					party: 1,
					round,
					message: encMessage,
					nonce: _sodium.to_hex(nonce),
				},
			};
			const keygenConversationNew = await sendMessage(
				pairingData.token,
				'keygen',
				keygenConversation,
				expectResponse,
			);

			if (expectResponse && keygenConversationNew) {
				keygenConversation = keygenConversationNew;
			}
			if (keygenConversation.isApproved === false) {
				throw new SnapError(
					`User(phone) denied keygen`,
					SnapErrorCode.UserPhoneDenied,
				);
			}
			round++;
		}
		running = false;

		return {
			// publicKey: keyshare.data.root_public_key.point,
			publicKey: keyshare.public_key,
			keyShareData: keyshare,
			elapsedTime: Date.now() - startTime,
		};
	} catch (error) {
		if (error instanceof SnapError) {
			if (error.code != SnapErrorCode.KeygenResourceBusy) {
				running = false;
			}
			throw error;
		} else if (error instanceof Error) {
			throw new SnapError(error.message, SnapErrorCode.KeygenFailed);
		} else throw new SnapError('unknown-error', SnapErrorCode.UnknownError);
	}
};
