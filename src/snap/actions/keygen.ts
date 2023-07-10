import { IP1KeyShare, P1KeyGen } from '@com.silencelaboratories/ecdsa-tss';
import * as utils from '../utils';
import { ConversationKeygen, PairingData } from '../../types';
import { sendMessage } from '../../firebaseEndpoints';
import _sodium, { base64_variants } from 'libsodium-wrappers';
import { SnapError, SnapErrorCode } from '../../error';

let running = false;

type KeygenResult = {
	public_key: string;
	keyShareData: IP1KeyShare;
	elapsed_time: number;
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
		const session_id = utils.random_session_id();
		const account_id = accountIdNumber;
		const p1 = new P1KeyGen(session_id, x1);
		await p1.init();

		let round = 1;

		let keygenConversation: ConversationKeygen | null = {
			account_id,
			created_at: Date.now(),
			expiry: 30000,
			message: {
				party: 1,
				round,
			},
			session_id,
		};

		let keyshare: IP1KeyShare | null = null;
		let expectResponse = true;
		await _sodium.ready;
		while (keyshare === null) {
			let decMessage: string | null = null;
			if (keygenConversation.message.message) {
				decMessage = utils.uint8ArrayToUtf8String(
					_sodium.crypto_box_open_easy(
						utils.b64ToUint8Array(
							keygenConversation.message.message,
						),
						_sodium.from_hex(keygenConversation.message.nonce),
						_sodium.from_hex(pairingData.app_public_key!),
						_sodium.from_hex(pairingData.web_enc_private_key!),
					),
				);
			}
			const msg = await p1.processMessage(decMessage);
			if (msg.p1_key_share) {
				keyshare = msg.p1_key_share;
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
			if (keygenConversation.is_approved === false) {
				throw new SnapError(
					`User(phone) denied keygen`,
					SnapErrorCode.UserPhoneDenied,
				);
			}
			round++;
		}
		running = false;

		return {
			public_key: keyshare.public_key,
			keyShareData: keyshare,
			elapsed_time: Date.now() - startTime,
		};
	} catch (error) {
		if (error instanceof SnapError) {
			throw error;
		} else if (error instanceof Error) {
			throw new SnapError(error.message, SnapErrorCode.KeygenFailed);
		} else throw new SnapError('unknown-error', SnapErrorCode.UnknownError);
	}
};
