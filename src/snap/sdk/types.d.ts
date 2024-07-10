// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import { DistributedKey, IP1KeyShare, SignMetadata, SignResult } from '../types';

export interface ISnapSDK {
  isPaired: () => Promise<{
    isPaired: boolean;
    deviceName: string;
    isAccountExist: false | DistributedKey | null;
  } | {
    isPaired: boolean;
    deviceName: null;
    isAccountExist?: never;
  }>,
  unpair: () => Promise<void>,
  initPairing: () => Promise<string>,
  runPairing: () => Promise<{
    pairingStatus: string;
    newAccountAddress: string | null;
    deviceName: string;
    elapsedTime: number;
  }>,
  runKeygen: () => Promise<{
    distributedKey: {
      publicKey: string;
      accountId: number;
      keyShareData: IP1KeyShare;
    };
    elapsedTime: number;
  }>, runBackup: () => Promise<void>,
  runSign: (hashAlg: string, message: string, messageHashHex: string, signMetadata: SignMetadata, accountId: number, keyShare: IP1KeyShare) => Promise<SignResult>
  setSnapVersion: (snapVersion: string) => Promise<void>,
  getSnapVersion: () => Promise<string>
}