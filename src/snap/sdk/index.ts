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

  /**
   * Create instance if not created, use storage provided. 
   * This is done so that tests can provide there own storage.
   * @param storage 
   * @returns instance of SnapSDK
   */
  static instance = async (storage: IStorage) => {
    if (SnapSDK.#instance === null) {
      SnapSDK.#instance = new SnapSDK(storage);
    } else if (storage) {
      SnapSDK.#instance.#storage = storage;
    }
    return SnapSDK.#instance;
  }

  /**
   * Check is snap is paired or not
   */
  isPaired = async () => {
    try {
      const silentShareStorage = await this.#storage.getStorageData();
      const deviceName = silentShareStorage.pairingData.deviceName;
      return {
        isPaired: true,
        deviceName,
        // Avoid chaning this, have some legacy reference
        isAccountExist:
          (silentShareStorage.pairingData.pairingId ===
            silentShareStorage.newPairingState?.pairingData
              ?.pairingId &&
            silentShareStorage.newPairingState?.distributedKey) ? true : false,
      };
    } catch {
      return {
        isPaired: false,
        deviceName: null,
      };
    }
  }

  /**
   * Unpair the snap and clear storage data
   */
  unpair = async () => {
    await this.#storage.clearStorageData();
  }

  /**
   * initialize pairing 
   */
  initPairing = async () => {
    const qrCode = await this.#pairingAction.init();
    return qrCode;
  }

  /**
   * run pairing, should be called after init pairing
   * timout is 30sec for this method. Will throw error after that.
   */
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

  /**
   * re pair with the existing account in the storage 
   * OR
   * can pair with new account
   * timout is 30sec for this method. Will throw error after that.
   */
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

  /**
   * Refersh the JWT token of a user
   */
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

  /**
   * Get pairing data and storage data from storage
   */
  #getPairingDataAndStorage = async () => {
    const silentShareStorage: StorageData = await this.#storage.getStorageData();
    let pairingData = silentShareStorage.pairingData;
    if (pairingData.tokenExpiration < Date.now() - TOKEN_LIFE_TIME) {
      pairingData = await this.refreshPairing();
    }
    return { pairingData, silentShareStorage };
  }

  /**
   * Run keygen will be called after pairing is done
   * Snap and Mobile will communicate few times. 
   * Each commuincation has a timeout of 30sec
   */
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

  /**
   * Run backup should be called after keygen is done
   * This will encrypt the backup using MetaMask entropy and send the encrypted backup to the phone.
   */
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

  /**
   * This should be called after keygen is done
   * To sign a new transcation, snap and mobile will communicate using transport.
   * Consist of 3 rounds and each round has a timeout of 30sec.
   * 
   * @param hashAlg 
   * @param message 
   * @param messageHashHex 
   * @param signMetadata 
   * @param accountId 
   * @param keyShare 
   * @returns SignResult
   */
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

  /**
   * This is to set the snap version of a user in database 
   * so phone can respond accordingly and ask user to update the snap
   * This feature is still experimental.
   * @param snapVersion 
   */
  setSnapVersion = async (snapVersion: string) => {
    const { pairingData } = await this.#getPairingDataAndStorage();
    await this.#userAction.setSnapVersion(pairingData.token, snapVersion);
  }

  /**
   * To get the snap version from a truthful source 
   * If new version is available then dApp can prompt user to update the snap
   */
  getSnapVersion = async () => {
    return await this.#httpClient.snapVersion();
  }

  /**
   * This method is used only for tests 
   * This method is not available in production
   * This can return critical information
   */
  getStorageData = async () => {
    return await this.#storage.getStorageData();
  }
}