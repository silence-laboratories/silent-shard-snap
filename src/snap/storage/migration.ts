// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import { StorageData, V0StorageData, V1StorageData } from "./types"

export class Migration {
  #storageData: StorageData;
  #latestVersion: number;

  constructor(storageData: StorageData, version: number) {
    this.#storageData = storageData;
    this.#latestVersion = version;
  };

  /**
   * return the latest storage data with modified type
   * @returns V1StorageData
   */
  #getV1StorageData = (): V1StorageData => {
    return this.#storageData as V1StorageData;
  }

  /**
   * Migrate V0 data to V1
   * @param data V0StorageData
   * @returns V1StorageData
   */
  #migrateV0toV1 = (data: V0StorageData): V1StorageData => {
    return { ...data, version: 1 };
  }

  /**
   * get version of the current storage data
   * @returns version number
   */
  #getVersion = () => {
    try {
      //@ts-ignore
      return this.data.version as number;
    }
    catch (e) { return 0; }
  }

  /**
   * Migrate to any old version to latest version
   * Right now only migration possible is from V0 -> V1
   */
  #migrate = () => {
    const currentVersion = this.#getVersion()

    if (currentVersion === this.#latestVersion) return;

    switch (currentVersion) {
      case 0: this.#migrateV0toV1;
      // case 1 : this.migrateV1toV2;
      // case 2 : this.migrateV2toV3;
    }
  }

  /**
   * Migrate the data the return the latest storage data
   * @returns StorageData
   */
  public getStorageData = () => {
    this.#migrate();
    return this.#getV1StorageData();
  }
}