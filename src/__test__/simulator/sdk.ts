import { b64ToString, toHexString } from './../../snap/utils';
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
	private unSub?: () => any;

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

	public checkBackup = () => {};

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
		await new Promise<void>((resolve, reject) => {
			this.unSub = onSnapshot(
				doc(db, 'keygen', this.pairingId!),
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
						const isApproved = true;
						if (!isApproved && this.uid) {
							await setDoc(doc(db, 'keygen', this.pairingId!), {
								...conversation,
								isApproved: false,
							} as KeygenConversation);
							resolve();
						} else if (
							message.party === 1 &&
							message.message &&
							message.nonce
						) {
							if (p2 === null) {
								const sessionId = conversation.sessionId;
								const x2 = await randBytes(32);
								p2 = new P2KeyGen(sessionId, x2);
							}

							const decMessage = uint8ArrayToUtf8String(
								_sodium.crypto_box_open_easy(
									b64ToUint8Array(message.message),
									_sodium.from_hex(message.nonce),
									this.webEncPublicKey,
									this.phoneEncPrivateKey,
								),
							);

							const decodedMessage = b64ToString(decMessage);

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

								await setDoc(
									doc(db, 'keygen', this.pairingId!),
									{
										...conversation,
										message: {
											nonce: _sodium.to_hex(nonce),
											message: encMessage,
											party: 2,
											round,
										},
										isApproved: true,
									},
								);
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
		if (this.unSub) {
			this.unSub();
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
		const result = await new Promise<string | null>((resolve, reject) => {
			this.unSub = onSnapshot(
				doc(db, 'sign', this.pairingId!),
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
						const expiry_at =
							conversation.createdAt + conversation.expiry;
						const now = Date.now();
						if (expiry_at < now) {
							console.error(
								'Data expired but process will continue',
							);
						}
						const isApproved = true;
						if (!isApproved) {
							await setDoc(doc(db, 'sign', this.pairingId!), {
								...conversation,
								isApproved: false,
							});
						} else if (
							message.party === 1 &&
							message.message &&
							message.nonce
						) {
							if (p2 === null) {
								let messageHash;
								if (conversation.hashAlg === 'keccak256')
									messageHash = keccak256(
										'0x' + conversation.signMessage,
									).toString('hex');
								else if (
									conversation.hashAlg === 'signTypedDataV1'
								)
									messageHash = typedSignatureHash(
										JSON.parse(conversation.signMessage),
									);
								else
									messageHash = TypedDataUtils.eip712Hash(
										JSON.parse(conversation.signMessage),
										SignTypedDataVersion.V4,
									).toString('hex');
								if (messageHash.startsWith('0x')) {
									messageHash = messageHash.slice(2);
								}
								p2 = new P2Signature(
									conversation.sessionId,
									fromHexStringToBytes(messageHash),
									this.keyshare,
								);
							}
							const decMessage = uint8ArrayToUtf8String(
								_sodium.crypto_box_open_easy(
									b64ToUint8Array(message.message),
									_sodium.from_hex(message.nonce),
									this.webEncPublicKey,
									this.phoneEncPrivateKey,
								),
							);
							const msg = await p2.processMessage(decMessage);
							if (msg.msg_to_send) {
								const nonce = _sodium.randombytes_buf(
									_sodium.crypto_box_NONCEBYTES,
								);
								const encMessage = _sodium.to_base64(
									_sodium.crypto_box_easy(
										msg.msg_to_send,
										nonce,
										this.webEncPublicKey,
										this.phoneEncPrivateKey,
									),
								);
								await setDoc(doc(db, 'sign', this.pairingId!), {
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
							} else {
								resolve(null);
							}
						}
					}
				},
			);
		});
		if (this.unSub) {
			this.unSub();
		}
	};

	public backup = () => {
		this.unSub = onSnapshot(
			doc(db, 'backup', this.pairingId!),
			async (querySnapshot) => {
				const conversation = querySnapshot.data() as BackupConversation;
				if (conversation?.backupData) {
					this.backupData = conversation.backupData;
					if (this.unSub) {
						this.unSub();
					}
				}
			},
		);
	};

	public stop = () => {
		if (this.unSub) {
			this.unSub();
		}
	};

	

	
}

const sdkSingleton = new sdk2();

export { sdkSingleton as sdk };
