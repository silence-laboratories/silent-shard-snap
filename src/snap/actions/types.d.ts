// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

export interface PairingDataInit {
  pairingId: string;
  encPair: _sodium.KeyPair;
  signPair: _sodium.KeyPair;
}

export interface IPairingAction {
  init: () => Promise<string>,
  getPairingSessionData: (currentAccountAddress?: string) => Promise<{
    newPairingState: {
      pairingData: PairingData;
      distributedKey: DistributedKey | null;
      accountId: string | null;
    };
    elapsedTime: number;
    deviceName: string;
  }>,
  refreshToken: (pairingData: PairingData) => Promise<{
    newPairingData: PairingData;
    elapsedTime: number;
  }>,
}

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


export type KeygenResult = {
  publicKey: string;
  keyShareData: IP1KeyShare;
  elapsedTime: number;
};

export interface IKeygenAction {
  keygen: (pairingData: PairingData, accountIdNumber: number, x1: Uint8Array) => Promise<KeygenResult>
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

export type SignResult = {
  signature: string;
  recId: number;
  elapsedTime: number;
}

export interface ISignAction {
  sign: (pairingData: PairingData, keyShare: IP1KeyShare, hashAlg: string, message: string, messageHash: Uint8Array, signMetadata: SignMetadata, accountId: number) => Promise<SignResult>,
}

export interface BackupConversation {
  createdAt: number;
  expiry: number;
  backupData: string;
  isBackedUp: boolean | null;
  pairingId: string;
  address: string;
  walletId: string;
}

export interface IBackupAction {
  backup: (pairingData: PairingData, encryptedMessage: string, address: string) => Promise<void>
}

export interface IUserAction {
  setSnapVersion: (token: string, snapVersion: string) => Promise<void>
}