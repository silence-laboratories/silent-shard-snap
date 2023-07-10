import { IP1KeyShare } from '@com.silencelaboratories/ecdsa-tss';

interface Message {
	party: number;
	round: number;
	message?: string;
	nonce?: string;
}

interface ConversationKeygen {
	account_id: number;
	created_at: number;
	expiry: number;
	is_approved?: boolean;
	message: Message;
	session_id: string;
	backup_data?: string;
}

interface ConversationSign {
	sign_metadata: 'eth_transaction' | 'eth_sign';
	account_id: number;
	created_at: number;
	expiry: number;
	is_approved?: boolean;
	message: Message;
	session_id: string;
	public_key: string;
	hash_alg: string;
	sign_message: string;
}

type Conversation = ConversationKeygen | ConversationSign |  {is_pairied: boolean};

export interface PairingData {
	pairing_id: string;
	web_enc_public_key: string;
	web_enc_private_key: string;
	web_sign_public_key: string;
	web_sign_private_key: string;
	token: string;
	token_expiration: number;
	app_public_key: string;
	device_name: string;
}

export interface DistributedKey {
	account_id: number;
	public_key: string;
	key_share_data: IP1KeyShare;
}

export interface StorageData {
	pairing_data: PairingData;
	distributed_keys: DistributedKey[];
}

export { Conversation, ConversationKeygen, ConversationSign };
