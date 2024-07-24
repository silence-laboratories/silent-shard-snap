// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import { SnapError, SnapErrorCode } from '../error';
import { Migration } from './migration';
import { IStorage, StorageData, } from './types';

const STORAGE_KEY = 'SilentShare1';


export class Storage implements IStorage {
  static #instance: Storage | null = null;
  readonly #VERSION = 1;

  /**
   * Save a storage data locally to read the data faster. 
   * If null then read from the storage first.
   */
  #storageData: StorageData | null = null;

  static instance = async () => {
    if (Storage.#instance == null) {
      Storage.#instance = new Storage();
      await Storage.#instance.migrate();
    }
    return Storage.#instance;
  }

  /**
   * Delete the stored data, if it exists.
   */
  clearStorageData = async () => {
    try {
      this.#storageData = null;

      await snap.request({
        method: 'snap_manageState',
        params: { operation: 'clear' },
      });

    } catch (error) {
      throw error instanceof Error
        ? new SnapError(error.message, SnapErrorCode.StorageError)
        : new SnapError(`unknown-error`, SnapErrorCode.UnknownError, 'isStorageExist in localStorage');
    }
  };

  /**
   * Save SilentShareStorage
   *
   * @param data obj to save
   */
  setStorageData = async (data: Omit<StorageData, 'version'>) => {
    try {
      if (data == null) {
        throw new SnapError(
          'Storage data cannot be null',
          SnapErrorCode.InvalidStorageData,
        );
      }

      const state = {
        [STORAGE_KEY]: JSON.stringify({ ...data, version: this.#VERSION })
      };
      await snap.request({
        method: 'snap_manageState',
        params: { operation: 'update', newState: state },
      });
      this.#storageData = { ...data, version: this.#VERSION };
      return;
    } catch (error) {
      throw error instanceof Error
        ? new SnapError(error.message, SnapErrorCode.StorageError)
        : new SnapError(`unknown-error`, SnapErrorCode.UnknownError);
    }
  };

  /**
   * Retrieve SilentShareStorage
   *
   * @returns StorageData object
   */
  getStorageData = async (): Promise<StorageData> => {
    try {
      if (this.#storageData) {
        return this.#storageData;
      }

      const state = await snap.request({
        method: 'snap_manageState',
        params: { operation: 'get' },
      });

      if (!state) {
        throw new SnapError('Snap is not paired', SnapErrorCode.NotPaired);
      }

      const jsonObject: StorageData = JSON.parse(
        state[STORAGE_KEY] as string,
      );

      this.#storageData = jsonObject;

      return jsonObject;
    } catch (error) {
      throw error instanceof Error
        ? new SnapError(error.message, SnapErrorCode.StorageError)
        : new SnapError(`unknown-error`, SnapErrorCode.UnknownError);
    }
  };


  private migrate = async () => {
    try {
      const storageData = await this.getStorageData();

      const migration = new Migration(storageData, this.#VERSION);

      const newStorageData = migration.getStorageData();

      await this.setStorageData(newStorageData);
    } catch (e) {
      // Migration failed. 
    }
  };
}