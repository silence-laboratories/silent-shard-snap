// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import { KeyringAccount, KeyringRequest } from '@metamask/keyring-api';

export interface IStorage {
  isStorageExist: () => Promise<boolean>;
  clearStorageData: () => Promise<void>;
  setStorageData: (data: Omit<StorageData, 'version'>) => Promise<void>;
  getStorageData: () => Promise<StorageData>;
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

export interface Wallet {
  account: KeyringAccount;
  distributedKey: DistributedKey;
};

export interface KeyringState {
  wallets: Record<string, Wallet>;
  requests: Record<string, KeyringRequest>;
};

export interface V0SnapState {
  pairingData: PairingData;
  newPairingState?: {
    pairingData: PairingData | null;
    distributedKey: DistributedKey | null;
    accountId: string | null;
  };
};

export type V0StorageData = KeyringState & V0SnapState

export interface V1SnapState extends V0SnapState {
  version: number;
};

export type V1StorageData = KeyringState & V1SnapState

export type StorageData = V1StorageData;

export interface IMigration {
  public getStorageData: () => V1StorageData;
}