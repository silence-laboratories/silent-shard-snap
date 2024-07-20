// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import * as Entropy from '../entropy';
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
import { SignMetadata, IStorage, StorageData, IP1KeyShare } from '../types';

const TOKEN_LIFE_TIME = 60000;
const baseUrl = process.env.IS_PRODUCTION
  ? 'https://us-central1-mobile-wallet-mm-snap.cloudfunctions.net'
  : 'https://us-central1-mobile-wallet-mm-snap-staging.cloudfunctions.net';

export default class SnapSDK {
  #storage: IStorage;
  #httpClient: HttpClient;
  #pairingAction: PairingAction;
  #keygenAction: KeygenAction;
  #signAction: SignAction;
  #backupAction: BackupAction;
  #userAction: UserAction;
  static #instance: SnapSDK | null = null;

  constructor(storage: IStorage) {
    this.#storage = storage;
    this.#httpClient = new HttpClient(baseUrl);
    this.#pairingAction = new PairingAction(this.#httpClient);
    this.#keygenAction = new KeygenAction(this.#httpClient);
    this.#signAction = new SignAction(this.#httpClient);
    this.#backupAction = new BackupAction(this.#httpClient);
    this.#userAction = new UserAction(this.#httpClient);
  }

  static instance = async (storage?: IStorage) => {
    if (SnapSDK.#instance === null) {
      const storageInstance = storage ?? await Storage.instance();
      SnapSDK.#instance = new SnapSDK(storageInstance);
    } else if (storage) {
      SnapSDK.#instance.#storage = storage;
    }
    return SnapSDK.#instance;
  }

  isPaired = async () => {
    try {
      const silentShareStorage = await this.#storage.getStorageData();
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
    const qrCode = await this.#pairingAction.init();
    return qrCode;
  }

  runPairing = async () => {
    const result = await this.#pairingAction.getPairingSessionData();
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
    const silentShareStorage: StorageData = await this.#storage.getStorageData();

    const currentDistributedKey = silentShareStorage.newPairingState?.distributedKey;
    if (!currentDistributedKey) {
      throw new SnapError('Not Paired', SnapErrorCode.NotPaired);
    }
    const currentAccountAddress = getAddressFromDistributedKey(
      currentDistributedKey,
    );

    const result = await this.#pairingAction.getPairingSessionData(
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
    const silentShareStorage: StorageData = await this.#storage.getStorageData();
    const pairingData = silentShareStorage.pairingData;
    const result = await this.#pairingAction.refreshToken(pairingData);
    await this.#storage.setStorageData({
      ...silentShareStorage,
      pairingData: result.newPairingData,
    });
    return result.newPairingData;
  }

  #getPairingDataAndStorage = async () => {
    const silentShareStorage: StorageData = await this.#storage.getStorageData();
    let pairingData = silentShareStorage.pairingData;
    if (pairingData.tokenExpiration < Date.now() - TOKEN_LIFE_TIME) {
      pairingData = await this.refreshPairing();
    }
    return { pairingData, silentShareStorage };
  }

  runKeygen = async () => {
    const { pairingData, silentShareStorage } = await this.#getPairingDataAndStorage();
    const wallets = silentShareStorage.wallets;
    const accountId = Object.keys(wallets).length + 1;
    const x1 = fromHexStringToBytes(await Entropy.requestEntropy());
    const result = await this.#keygenAction.keygen(pairingData, accountId, x1);
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
    const { pairingData, silentShareStorage } = await this.#getPairingDataAndStorage();
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
    const { pairingData } = await this.#getPairingDataAndStorage();
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
    const { pairingData } = await this.#getPairingDataAndStorage();
    await this.#userAction.setSnapVersion(pairingData.token, snapVersion);
  }

  getSnapVersion = async () => {
    return await this.#httpClient.snapVersion();
  }

  getStorageData = async () => {
    return await this.#storage.getStorageData();
  }
}