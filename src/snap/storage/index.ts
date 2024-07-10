// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import { SnapError, SnapErrorCode } from '../error';
import { Migration } from './migration';
import { IStorage, StorageData, } from './types';

const STORAGE_KEY = 'SilentShare1';


export class Storage implements IStorage {
  private static _instance: Storage | null = null;
  private VERSION = 1;

  static instance = async () => {
    if (Storage._instance == null) {
      Storage._instance = new Storage();
      await Storage._instance.migrate();
    }
    return Storage._instance;
  }

  /**
   * Check if a storage exist for the wallet
   *
   * @returns true if exists, false otherwise
   */
  isStorageExist = async (): Promise<boolean> => {
    try {
      let data = await snap.request({
        method: 'snap_manageState',
        params: { operation: 'get' },
      });
      return data !== null;
    } catch (error) {
      throw error instanceof Error
        ? new SnapError(error.message, SnapErrorCode.StorageError)
        : new SnapError(`unknown-error`, SnapErrorCode.UnknownError, 'isStorageExist in storage');
    }
  };

  /**
   * Delete the stored data, if it exists.
   */
  clearStorageData = async () => {
    try {
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

      let state: {
        SilentShare1?: string;
      } = {};
      state[STORAGE_KEY] = JSON.stringify({ ...data, version: this.VERSION });

      await snap.request({
        method: 'snap_manageState',
        params: { operation: 'update', newState: state },
      }); return;
    } catch (error) {
      throw error instanceof Error
        ? new SnapError(error.message, SnapErrorCode.StorageError)
        : new SnapError(`unknown-error`, SnapErrorCode.UnknownError);
    }
  };

  /**
   * Retrieve SilentShareStorage
   *
   * @returns SilentShareStorage object
   */
  getStorageData = async (): Promise<StorageData> => {
    try {
      const _isStorageExist = await this.isStorageExist();
      if (!_isStorageExist) {
        throw new SnapError('Snap is not paired', SnapErrorCode.NotPaired);
      }

      let state = await snap.request({
        method: 'snap_manageState',
        params: { operation: 'get' },
      });

      if (!state) {
        throw new SnapError(
          'Snap failed to fetch state',
          SnapErrorCode.UnknownError,
        );
      }

      const jsonObject: StorageData = JSON.parse(
        state[STORAGE_KEY] as string,
      );

      console.log('Storage data', JSON.stringify(jsonObject));

      return jsonObject;
    } catch (error) {
      throw error instanceof Error
        ? new SnapError(error.message, SnapErrorCode.StorageError)
        : new SnapError(`unknown-error`, SnapErrorCode.UnknownError);
    }
  };


  private migrate = async () => {
    if (!this.isStorageExist()) {
      return;
    }

    try {
      const storageData = await this.getStorageData();

      const migration = new Migration(storageData, this.VERSION);

      const newStorageData = migration.getStorageData();

      await this.setStorageData(newStorageData);
    } catch (e) {
      // Migration failed. Do not save the new storage data;
    }
  };
}