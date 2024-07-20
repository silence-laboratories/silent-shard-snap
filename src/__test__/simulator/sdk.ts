import {
	IP2KeyShare,
	P2KeyGen,
	P2Signature,
	randBytes,
} from '@silencelaboratories/ecdsa-tss';
import * as utils from './../../snap/utils/utils';
import _sodium, { base64_variants } from 'libsodium-wrappers';
import { onSnapshot, setDoc, doc, Firestore } from 'firebase/firestore';
import keccak256 from 'keccak256';
import {
	BackupConversation,
	KeygenConversation,
	Message,
	SignConversation,
} from '../../snap/types';
import { Unsubscribe } from 'firebase/auth';
import { DEVICE_NAME } from '../constants';

enum Collection {
	pairing = 'pairing',
	keygen = 'keygen',
	sign = 'sign',
	backup = 'backup'
}

export class SimulatorSdk {
	#db: Firestore;
	#uid: string;
	#phoneEncPrivateKey: Uint8Array;
	#phoneEncPublicKey: Uint8Array;
	#webEncPublicKey?: Uint8Array;
	#keyshare?: IP2KeyShare;
	#backupData?: string;

	constructor(uid: string, db: Firestore) {
		this.#uid = uid;
		this.#db = db;
		const encPair = _sodium.crypto_box_keypair();
		this.#phoneEncPrivateKey = encPair.privateKey;
		this.#phoneEncPublicKey = encPair.publicKey;
	}

	static init = async () => {
		await _sodium.ready;
	}

	public pairing = async (qrCode: QrCode, isRepair = false) => {
		try {
			if (isRepair && this.#backupData == null) {
				throw new Error('Not backup data found');
			}

			const { pairingId, signPublicKey, webEncPublicKey } = qrCode;
			this.#webEncPublicKey = _sodium.from_hex(webEncPublicKey);

			await setDoc(doc(this.#db, Collection.pairing, pairingId), {
				userId: this.#uid,
				signPublicKey,
				phoneEncPublicKey: _sodium.to_hex(this.#phoneEncPublicKey),
				deviceName: DEVICE_NAME,
				createdat: Date.now(),
				expiry: 30000,
				backupData: isRepair ? this.#backupData : null,
			});
		} catch (error) {
			throw error;
		}
	};

	public keygen = async () => {
		let p2: P2KeyGen | null = null;
		let round = 1;
		await new Promise<void>((resolve) => {
			const keygenUnsub = onSnapshot(
				doc(this.#db, Collection.keygen, this.#uid),
				async (querySnapshot) => {
					if (!this.#webEncPublicKey) {
						throw new Error(`webEncPublicKey missing, do pairing before keygen`);
					}
					const conversation = querySnapshot.data() as KeygenConversation;
					if (conversation) {
						const message = conversation.message;
						this._validateMessage(conversation);
						if (
							message.party === 1 &&
							message.message &&
							message.nonce
						) {
							if (p2 === null) {
								const sessionId = conversation.sessionId;
								const x2 = await randBytes(32);
								p2 = new P2KeyGen(sessionId, x2);
							}

							const decodedMessage =
								this._decryptMessage(message);

							const msg = await p2.processMessage(decodedMessage);
							if (msg.msg_to_send) {
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
										this.#webEncPublicKey,
										this.#phoneEncPrivateKey,
									),
								);

								await setDoc(doc(this.#db, Collection.keygen, this.#uid), {
									...conversation,
									message: {
										nonce: _sodium.to_hex(nonce),
										message: encMessage,
										party: 2,
										round,
									},
									isApproved: true,
								});
								round++;
							} else if (msg.p2_key_share) {
								this.#keyshare = msg.p2_key_share;
								if (keygenUnsub) {
									console.log('keygen unsub');
									keygenUnsub();
								}
								resolve();
							}
						}
					}
				},
				(error) => {
					console.log('Error getting keygen conversation', error);
					if (keygenUnsub) {
						keygenUnsub();
					}
					resolve();
				},
			);
		});
	};

	public sign = async () => {
		let p2: P2Signature | null = null;
		let round = 1;
		return await new Promise<Unsubscribe>((resolve) => {
			const signUnSub = onSnapshot(
				doc(this.#db, Collection.sign, this.#uid),
				async (querySnapshot) => {
					if (!this.#webEncPublicKey) {
						throw new Error(`webEncPublicKey missing`);
					}
					if (!this.#keyshare) {
						throw new Error(`keyshare missing`);
					}
					const conversation = querySnapshot.data() as SignConversation;
					if (conversation) {
						const message = conversation.message;
						this._validateMessage(conversation);
						if (
							message.party === 1 &&
							message.message &&
							message.nonce
						) {
							if (p2 === null || p2._state === 0) {
								round = 1;
								const messageHash =
									this._hashSignMsg(conversation);
								p2 = new P2Signature(
									conversation.sessionId,
									utils.fromHexStringToBytes(messageHash),
									this.#keyshare,
								);
							}

							const decodedMessage =
								this._decryptMessage(message);
							const msg = await p2.processMessage(decodedMessage);
							if (msg.msg_to_send) {
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
										this.#webEncPublicKey,
										this.#phoneEncPrivateKey,
									),
								);
								await setDoc(doc(this.#db, Collection.sign, this.#uid), {
									...conversation,
									message: {
										nonce: _sodium.to_hex(nonce),
										message: encMessage,
										party: 2,
										round,
									},
									isApproved: true,
								});
								round++;
							}
						}
					}
				},
				(error) => {
					console.log('Error getting sign conversation', error);
					if (signUnSub) {
						signUnSub();
					}
				},
			);
			resolve(signUnSub);
		});
	};

	public backup = async () => {
		await new Promise<void>((resolve) => {
			const backupUnsub = onSnapshot(
				doc(this.#db, Collection.backup, this.#uid),
				async (querySnapshot) => {
					const conversation = querySnapshot.data() as BackupConversation;
					if (conversation?.backupData) {
						this.#backupData = conversation.backupData;
						if (backupUnsub) {
							console.log('backup unsub');
							backupUnsub();
						}
						resolve();
					}
				},
			);
		});


	};

	_hashSignMsg = (conversation: SignConversation) => {
		let messageHash;
		switch (conversation.signMetadata) {
			case 'eth_transaction':
			case 'legacy_transaction':
				messageHash = keccak256(
					'0x' + conversation.signMessage,
				).toString('hex');
				break;
			case 'personal_sign':
				let messageToSignBytes = Buffer.from(
					conversation.signMessage,
					'hex',
				);
				let prefix = `\x19Ethereum Signed Message:\n${messageToSignBytes.length}`;
				let prefixBytes = Buffer.from(prefix, 'utf8');
				let msg = Buffer.concat([prefixBytes, messageToSignBytes]);
				messageHash = keccak256(msg).toString('hex');
				break;
			default:
				messageHash = conversation.messageHash;
		}

		if (messageHash.startsWith('0x')) {
			messageHash = messageHash.slice(2);
		}
		return messageHash;
	};

	_validateMessage = (conversation: SignConversation | KeygenConversation) => {
		const expiry_at = conversation.createdAt + conversation.expiry;
		const now = Date.now();
		if (conversation.createdAt > now) {
			console.error(
				`Sign message on round ${conversation.message.round} of party ${conversation.message.party} has incorrect creation date`,
			);
		}
		if (expiry_at < now) {
			console.error(
				`Sign message on round ${conversation.message.round} of party ${conversation.message.party} expired`,
			);
		}
	};

	_decryptMessage = (message: Message) => {
		const decMessage = utils.uint8ArrayToUtf8String(
			_sodium.crypto_box_open_easy(
				utils.b64ToUint8Array(message.message!),
				_sodium.from_hex(message.nonce!),
				this.#webEncPublicKey!,
				this.#phoneEncPrivateKey!,
			),
		);
		const decodedMessage = utils.b64ToString(decMessage);
		return decodedMessage;
	};
}

// const sdkSingleton = new SimulatorSdk();

// export { sdkSingleton as sdk };
