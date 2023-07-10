import { P1Signature } from '@com.silencelaboratories/ecdsa-tss';
import * as utils from '../utils';
import { sendMessage } from '../../firebaseEndpoints';
import { ConversationSign, DistributedKey, PairingData } from '../../types';
import _sodium, { base64_variants } from 'libsodium-wrappers';
import { SnapError, SnapErrorCode } from '../../error';

let running: boolean = false;

type SignResult = {
	signature: string;
	rec_id: number;
	elapsed_time: number;
};

export const sign = async (
	pairingData: PairingData,
	distributedKey: DistributedKey,
	hashAlg: string,
	message: string,
	messageHash: Uint8Array,
	sign_metadata: 'eth_transaction' | 'eth_sign',
): Promise<SignResult> => {
	try {
		if (running) {
			throw new SnapError(
				`Sign already running`,
				SnapErrorCode.ResourceBusy,
			);
		}
		running = true;
		let startTime = Date.now();

		const account_id = distributedKey.account_id;
		const session_id = utils.random_session_id();
		let p1KeyShareObj = distributedKey.key_share_data;
		let round = 1;
		const p1 = new P1Signature(session_id, messageHash, p1KeyShareObj);

		let signConversation: ConversationSign = {
			sign_metadata,
			account_id,
			created_at: Date.now(),
			expiry: 30000,
			message: {
				party: 1,
				round: round,
			},
			session_id,
			hash_alg: hashAlg,
			public_key: distributedKey.public_key,
			sign_message: message,
		};

		let sign = null;
		let rec_id = null;
		let expectResponse = true;
		await _sodium.ready;
		while (sign === null) {
			let decMessage: string | null = null;
			if (signConversation.message.message) {
				decMessage = utils.uint8ArrayToUtf8String(
					_sodium.crypto_box_open_easy(
						utils.b64ToUint8Array(signConversation.message.message),
						_sodium.from_hex(signConversation.message.nonce),
						_sodium.from_hex(pairingData.app_public_key!),
						_sodium.from_hex(pairingData.web_enc_private_key!),
					),
				);
			}
			const msg = await p1.processMessage(decMessage).catch((error) => {
				throw new SnapError(
					`Internal library error: ${error}`,
					SnapErrorCode.InternalLibError,
				);
			});
			if (msg.signature) {
				sign = msg.signature;
				rec_id = msg.recid;
				expectResponse = false;
			}
			const nonce = _sodium.randombytes_buf(
				_sodium.crypto_box_NONCEBYTES,
			);
			const encMessage = utils.Uint8ArrayTob64(
				_sodium.crypto_box_easy(
					msg.msg_to_send,
					nonce,
					_sodium.from_hex(pairingData.app_public_key),
					_sodium.from_hex(pairingData.web_enc_private_key),
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
			const signConversationNew = (await sendMessage(
				pairingData.token,
				'sign',
				signConversation,
				expectResponse,
			)) as ConversationSign;
			if (expectResponse) {
				signConversation = signConversationNew;
			}
			if (signConversation.is_approved === false) {
				throw new SnapError(
					`User(phone) rejected sign request`,
					SnapErrorCode.UserPhoneDenied,
				);
			}
			round++;
		}

		running = false;
		return {
			signature: sign,
			rec_id,
			elapsed_time: Date.now() - startTime,
		};
	} catch (error) {
		if (error instanceof SnapError) {
			throw error;
		} else if (error instanceof Error) {
			throw new SnapError(error.message, SnapErrorCode.KeygenFailed);
		} else throw new SnapError('unknown-error', SnapErrorCode.SignFailed);
	}
};
