// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import { IP1KeyShare } from '@silencelaboratories/ecdsa-tss';
import { KeyringAccount, KeyringRequest } from '@metamask/keyring-api';

export interface Message {
	message?: string;
	nonce?: string;
	round: number;
	party: number;
}

export interface KeygenConversation {
	createdAt: number;
	expiry: number;
	isApproved: boolean | null;
	accountId: number;
	sessionId: string;
	message: Message;
}

export type SignMetadata =
	| 'legacy_transaction'
	| 'eth_transaction'
	| 'eth_sign'
	| 'personal_sign'
	| 'eth_signTypedData'
	| 'eth_signTypedData_v1'
	| 'eth_signTypedData_v2'
	| 'eth_signTypedData_v3'
	| 'eth_signTypedData_v4';

export interface SignConversation {
	createdAt: number;
	expiry: number;
	isApproved: boolean | null;
	accountId: number;
	hashAlg: string;
	signMessage: string;
	messageHash: string;
	signMetadata: SignMetadata;
	publicKey: string;
	sessionId: string;
	message: Message;
}

export interface BackupConversation {
	createdAt: number;
	expiry: number;
	backupData: string;
	isBackedUp: boolean | null;
	pairingId: string;
}

export interface PairingData {
	pairingId: string;
	webEncPublicKey: string;
	webEncPrivateKey: string;
	webSignPublicKey: string;
	webSignPrivateKey: string;
	token: string;
	tokenExpiration: number;
	appPublicKey: string;
	deviceName: string;
}

export interface DistributedKey {
	accountId: number;
	publicKey: string;
	keyShareData: IP1KeyShare;
}

export type Wallet = {
	account: KeyringAccount;
	distributedKey: DistributedKey;
};

export type KeyringState = {
	wallets: Record<string, Wallet>;
	requests: Record<string, KeyringRequest>;
};

export type StorageData = KeyringState & {
	pairingData: PairingData;
	newPairingState?: {
		pairingData: PairingData | null;
		distributedKey: DistributedKey | null;
		accountId: string | null;
	};
};
