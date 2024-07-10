// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import Entropy from '../entropy';
import HttpClient from '../transport/httpClient';
import { fromHexStringToBytes, getAddressFromDistributedKey } from '../utils/utils';
import { SnapError, SnapErrorCode } from '../error';
import { v4 as uuid } from 'uuid';
import { KeygenAction } from '../actions/keygen';
import { BackupAction } from '../actions/backup';
import { SignAction } from '../actions/sign';
import { PairingAction } from '../actions/pairing';
import { UserAction } from '../actions/user';
import { Storage } from '../storage';
import { ISnapSDK } from './types';
import { SignMetadata, IStorage, StorageData, IP1KeyShare } from '../types';

const TOKEN_LIFE_TIME = 60000;
const baseUrl = process.env.IS_PRODUCTION
  ? 'https://us-central1-mobile-wallet-mm-snap.cloudfunctions.net'
  : 'https://us-central1-mobile-wallet-mm-snap-staging.cloudfunctions.net';

export default class SnapSDK implements ISnapSDK {
  #storage: IStorage;
  #httpClient: HttpClient;
  #pairingAction: PairingAction;
  #keygenAction: KeygenAction;
  #signAction: SignAction;
  #backupAction: BackupAction;
  #userAction: UserAction;
  static #instance: SnapSDK | null = null;

  constructor(storage: IStorage) {
    console.log('baseUrl : ', baseUrl);
    this.#storage = storage;
    this.#httpClient = new HttpClient(baseUrl);
    this.#pairingAction = new PairingAction(this.#httpClient);
    this.#keygenAction = new KeygenAction(this.#httpClient);
    this.#signAction = new SignAction(this.#httpClient);
    this.#backupAction = new BackupAction(this.#httpClient);
    this.#userAction = new UserAction(this.#httpClient);
  }

  static instance = async () => {
    if (SnapSDK.#instance == null) {
      const storageInstance = await Storage.instance();
      SnapSDK.#instance = new SnapSDK(storageInstance);
    }
    return SnapSDK.#instance;
  }

  isPaired = async () => {
    try {
      let silentShareStorage = await this.#storage.getStorageData();
      const deviceName = silentShareStorage.pairingData.deviceName;
      return {
        isPaired: true,
        deviceName,
        // Avoid chaning this, have some legacy reference
        isAccountExist:
          silentShareStorage.pairingData.pairingId ===
          silentShareStorage.newPairingState?.pairingData
            ?.pairingId &&
          silentShareStorage.newPairingState?.distributedKey,
      };
    } catch {
      return {
        isPaired: false,
        deviceName: null,
      };
    }
  }

  unpair = async () => {
    await this.#storage.clearStorageData();
  }

  initPairing = async () => {
    let qrCode = await this.#pairingAction.init();
    return qrCode;
  }

  runPairing = async () => {
    let result = await this.#pairingAction.getPairingSessionData();
    await this.#storage.setStorageData({
      newPairingState: result.newPairingState,
      pairingData: result.newPairingState.pairingData,
      wallets: {},
      requests: {},
    });
    const distributedKey = result.newPairingState.distributedKey;
    return {
      pairingStatus: 'paired',
      newAccountAddress: distributedKey
        ? getAddressFromDistributedKey(distributedKey)
        : null,
      deviceName: result.deviceName,
      elapsedTime: result.elapsedTime,
    };
  }

  runRePairing = async () => {
    let silentShareStorage: StorageData = await this.#storage.getStorageData();
    const wallets = Object.values(silentShareStorage.wallets);
    const currentAccount = wallets.length > 0 ? wallets[0] : null;
    if (!currentAccount) {
      throw new SnapError('Not Paired', SnapErrorCode.NotPaired);
    }
    const currentAccountAddress = getAddressFromDistributedKey(
      currentAccount?.distributedKey,
    );

    let result = await this.#pairingAction.getPairingSessionData(
      currentAccountAddress,
    );

    const distributedKey = result.newPairingState.distributedKey;
    const newAccountAddress = distributedKey
      ? getAddressFromDistributedKey(distributedKey)
      : null;

    if (newAccountAddress === currentAccountAddress) {
      await this.#storage.setStorageData({
        ...silentShareStorage,
        pairingData: result.newPairingState.pairingData,
      });
    } else {
      await this.#storage.setStorageData({
        ...silentShareStorage,
        newPairingState: result.newPairingState,
      });
    }

    return {
      pairingStatus: 'paired',
      currentAccountAddress: currentAccountAddress
        ? [currentAccountAddress]
        : [],
      newAccountAddress,
      deviceName: result.deviceName,
      elapsedTime: result.elapsedTime,
    };
  }

  refreshPairing = async () => {
    let silentShareStorage: StorageData = await this.#storage.getStorageData();
    let pairingData = silentShareStorage.pairingData;
    let result = await this.#pairingAction.refreshToken(pairingData);
    await this.#storage.setStorageData({
      ...silentShareStorage,
      pairingData: result.newPairingData,
    });
    return result.newPairingData;
  }

  #getPairingDataAndStorage = async () => {
    let silentShareStorage: StorageData = await this.#storage.getStorageData();
    let pairingData = silentShareStorage.pairingData;
    if (pairingData.tokenExpiration < Date.now() - TOKEN_LIFE_TIME) {
      pairingData = await this.refreshPairing();
    }
    return { pairingData, silentShareStorage };
  }

  runKeygen = async () => {
    let { pairingData, silentShareStorage } = await this.#getPairingDataAndStorage();
    let wallets = silentShareStorage.wallets;
    let accountId = Object.keys(wallets).length + 1;
    let x1 = fromHexStringToBytes(await Entropy.requestEntropy());
    let result = await this.#keygenAction.keygen(pairingData, accountId, x1);
    await this.#storage.setStorageData({
      ...silentShareStorage,
      newPairingState: {
        pairingData: null,
        accountId: uuid(),
        distributedKey: {
          publicKey: result.publicKey,
          accountId,
          keyShareData: result.keyShareData,
        },
      },
    });
    return {
      distributedKey: {
        publicKey: result.publicKey,
        accountId: accountId,
        keyShareData: result.keyShareData,
      },
      elapsedTime: result.elapsedTime,
    };
  }

  runBackup = async () => {
    let { pairingData, silentShareStorage } = await this.#getPairingDataAndStorage();
    if (silentShareStorage.newPairingState?.distributedKey) {
      const encryptedMessage = await Entropy.encMessage(
        JSON.stringify(silentShareStorage.newPairingState.distributedKey),
      );
      await this.#backupAction.backup(
        pairingData,
        encryptedMessage,
        getAddressFromDistributedKey(
          silentShareStorage.newPairingState.distributedKey,
        ),
      );
    } else
      throw new SnapError(
        'Distributed key not found',
        SnapErrorCode.BackupFailed,
      );
  }

  runSign = async (
    hashAlg: string,
    message: string,
    messageHashHex: string,
    signMetadata: SignMetadata,
    accountId: number,
    keyShare: IP1KeyShare,
  ) => {
    if (messageHashHex.startsWith('0x')) {
      messageHashHex = messageHashHex.slice(2);
    }
    if (message.startsWith('0x')) {
      message = message.slice(2);
    }
    let { pairingData } = await this.#getPairingDataAndStorage();
    const messageHash = fromHexStringToBytes(messageHashHex);
    if (messageHash.length !== 32) {
      throw new SnapError(
        'Invalid length of messageHash, should be 32 bytes',
        SnapErrorCode.InvalidMessageHashLength,
      );
    }

    return await this.#signAction.sign(
      pairingData,
      keyShare,
      hashAlg,
      message,
      messageHash,
      signMetadata,
      accountId,
    );
  }

  setSnapVersion = async (snapVersion: string) => {
    let { pairingData } = await this.#getPairingDataAndStorage();
    await this.#userAction.setSnapVersion(pairingData.token, snapVersion);
  }

  getSnapVersion = async () => {
    return await this.#httpClient.snapVersion();
  }
}