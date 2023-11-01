import {
	IP1KeyShare,
	P1KeyGen,
	randBytes,
} from '@silencelaboratories/ecdsa-tss';
import * as utils from '../utils';
import { KeygenConversation, PairingData } from '../../types';
import { sendMessage } from '../../firebaseEndpoints';
import _sodium, { base64_variants } from 'libsodium-wrappers';
import { SnapError, SnapErrorCode } from '../../error';

let running = false;

type KeygenResult = {
	publicKey: string;
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
				SnapErrorCode.ResourceBusy,
			);
		}
		running = true;

		const startTime = Date.now();
		const sessionId = _sodium.to_hex(await randBytes(32)); //utils.random_session_id();
		const accountId = accountIdNumber;
		const p1 = new P1KeyGen(sessionId, x1);
		await p1.init();

		let round = 1;

		let keygenConversation: KeygenConversation = {
			accountId,
			createdAt: Date.now(),
			expiry: 30000,
			message: {
				party: 1,
				round,
			},
			sessionId,
			isApproved: null,
		};

		let keyshare: IP1KeyShare | null = null;
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
			publicKey: keyshare.public_key,
			keyShareData: keyshare,
			elapsedTime: Date.now() - startTime,
		};
	} catch (error) {
		if (error instanceof SnapError) {
			throw error;
		} else if (error instanceof Error) {
			throw new SnapError(error.message, SnapErrorCode.KeygenFailed);
		} else throw new SnapError('unknown-error', SnapErrorCode.UnknownError);
	}
};
