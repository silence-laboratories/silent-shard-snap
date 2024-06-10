import { b64ToString } from './../../snap/utils';
import {
	IP2KeyShare,
	P2KeyGen,
	P2Signature,
	randBytes,
} from '@silencelaboratories/ecdsa-tss';
import _sodium, { base64_variants } from 'libsodium-wrappers';
import { onSnapshot, setDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import {
	Uint8ArrayTob64,
	b64ToUint8Array,
	fromHexStringToBytes,
	uint8ArrayToUtf8String,
} from '../../snap/utils';
import keccak256 from 'keccak256';
import {
	SignTypedDataVersion,
	TypedDataUtils,
	typedSignatureHash,
} from '@metamask/eth-sig-util';
import {
	BackupConversation,
	KeygenConversation,
	Message,
	SignConversation,
} from '../../types';
import { DEVICE_NAME } from '../index.test';

class sdk2 {
	private phoneEncPrivateKey?: Uint8Array;
	private phoneEncPublicKey?: Uint8Array;
	private webEncPublicKey?: Uint8Array;
	private keyshare?: IP2KeyShare;
	private backupData?: string;
	private uid?: string | undefined;
	private pairingId?: string | undefined;

	public cleanState = () => {
		delete this.phoneEncPrivateKey;
		delete this.phoneEncPublicKey;
		delete this.webEncPublicKey;
		delete this.keyshare;
		delete this.backupData;
		delete this.uid;
		delete this.pairingId;
	};

	private signUnSub?: () => any;

	public setUid(theUid: string | undefined) {
		this.uid = theUid;
	}

	public getUid(): string | undefined {
		return this.uid;
	}

	public isPaired = () => {
		return true;
	};

	public isKeyshareExist = () => {
		if (this.keyshare) return true;
		return false;
	};

	public sendPairing = async (qrCode: string, isRepair = false) => {
		try {
			const encPair = _sodium.crypto_box_keypair();
			this.phoneEncPrivateKey = encPair.privateKey;
			this.phoneEncPublicKey = encPair.publicKey;
			const {
				pairingId,
				signPublicKey,
				webEncPublicKey,
			}: {
				pairingId: string;
				signPublicKey: string;
				webEncPublicKey: string;
			} = JSON.parse(qrCode);

			this.webEncPublicKey = _sodium.from_hex(webEncPublicKey);
			this.pairingId = pairingId;
			await setDoc(doc(db, 'pairing', pairingId), {
				userId: this.uid,
				signPublicKey: signPublicKey,
				phoneEncPublicKey: _sodium.to_hex(this.phoneEncPublicKey),
				deviceName: DEVICE_NAME,
				createdat: Date.now(),
				expiry: 30000,
				backupData: isRepair ? this.backupData ?? null : null,
			});
		} catch (error) {
			throw error;
		}
	};

	public keygen = async () => {
		if (!this.uid) {
			throw new Error(`Uid missing`);
		}
		if (!this.webEncPublicKey) {
			throw new Error(`webEncPublicKey missing`);
		}
		if (!this.phoneEncPrivateKey) {
			throw new Error(`phoneEncPrivateKey missing`);
		}
		let p2: P2KeyGen | null = null;
		let round = 1;
		let keygenUnsub: any;
		await new Promise<void>((resolve) => {
			keygenUnsub = onSnapshot(
				doc(db, 'keygen', this.uid!),
				async (querySnapshot) => {
					const conversation =
						querySnapshot.data() as KeygenConversation;
					if (
						!this.uid ||
						!this.webEncPublicKey ||
						!this.phoneEncPrivateKey
					) {
						return;
					}
					if (conversation) {
						const message = conversation.message;
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
								const encMessage = Uint8ArrayTob64(
									_sodium.crypto_box_easy(
										_sodium.to_base64(
											msg.msg_to_send,
											base64_variants.ORIGINAL,
										),
										nonce,
										this.webEncPublicKey,
										this.phoneEncPrivateKey,
									),
								);

								await setDoc(doc(db, 'keygen', this.uid!), {
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
								this.keyshare = msg.p2_key_share;
								resolve();
							}
						}
					}
				},
			);
		});
		if (keygenUnsub) {
			console.log('keygen unsub');
			keygenUnsub();
		}
	};

	public sign = async () => {
		await _sodium.ready;
		if (!this.uid) {
			throw new Error(`Uid missing`);
		}
		if (!this.webEncPublicKey) {
			throw new Error(`webEncPublicKey missing`);
		}
		if (!this.phoneEncPrivateKey) {
			throw new Error(`phoneEncPrivateKey missing`);
		}
		if (!this.keyshare) {
			throw new Error(`keyshare missing`);
		}
		let p2: P2Signature | null = null;
		let round = 1;
		let signUnSub: any;
		await new Promise<string | null>((resolve) => {
			signUnSub = onSnapshot(
				doc(db, 'sign', this.uid!),
				async (querySnapshot) => {
					const conversation =
						querySnapshot.data() as SignConversation;
					if (
						!this.uid ||
						!this.webEncPublicKey ||
						!this.phoneEncPrivateKey ||
						!this.keyshare
					) {
						return;
					}
					if (conversation) {
						const message = conversation.message;
						this._validateMessage(conversation);
						if (
							message.party === 1 &&
							message.message &&
							message.nonce
						) {
							if (p2 === null) {
								console.log('p2 is null only once');
								let messageHash;
								console.log(conversation.signMetadata);
								switch (conversation.signMetadata) {
									case 'eth_transaction':
									case 'legacy_transaction':
										messageHash = keccak256(
											'0x' + conversation.signMessage,
										).toString('hex');
										break;
									case 'personal_sign':
										let messageToSignBytes = Buffer.from(conversation.signMessage, 'hex');
										let prefix = `\u0019Ethereum Signed Message:\n${messageToSignBytes.length}`;
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
								round = 1;
								p2 = new P2Signature(
									conversation.sessionId,
									fromHexStringToBytes(messageHash),
									this.keyshare,
								);
							}

							const decodedMessage =
								this._decryptMessage(message);
							const msg = await p2.processMessage(decodedMessage);
							if (msg.msg_to_send) {
								const nonce = _sodium.randombytes_buf(
									_sodium.crypto_box_NONCEBYTES,
								);
								const encMessage = _sodium.to_base64(
									_sodium.crypto_box_easy(
										_sodium.to_base64(
											msg.msg_to_send,
											base64_variants.ORIGINAL,
										),
										nonce,
										this.webEncPublicKey,
										this.phoneEncPrivateKey,
									),
								);
								await setDoc(doc(db, 'sign', this.uid!), {
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
							} else if (msg.signature) {
								resolve(msg.signature);
								if (signUnSub) {
									console.log('sign unsub');
									signUnSub();
								}
							} else {
								resolve(null);
								if (signUnSub) {
									console.log('sign unsub');
									signUnSub();
								}
							}
						}
					}
				},
				(error) => {
					if (signUnSub) {
						signUnSub();
					}
				},
			);
		});
	};

	public backup = () => {
		let backupUnsub: any;
		backupUnsub = onSnapshot(
			doc(db, 'backup', this.uid!),
			async (querySnapshot) => {
				const conversation = querySnapshot.data() as BackupConversation;
				if (conversation?.backupData) {
					this.backupData = conversation.backupData;
					if (backupUnsub) {
						console.log('backup unsub');
						backupUnsub();
					}
				}
			},
		);
	};

	_validateMessage = (conversation: SignConversation) => {
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
		const decMessage = uint8ArrayToUtf8String(
			_sodium.crypto_box_open_easy(
				b64ToUint8Array(message.message!),
				_sodium.from_hex(message.nonce!),
				this.webEncPublicKey!,
				this.phoneEncPrivateKey!,
			),
		);
		const decodedMessage = b64ToString(decMessage);
		return decodedMessage;
	};
}

const sdkSingleton = new sdk2();

export { sdkSingleton as sdk };
