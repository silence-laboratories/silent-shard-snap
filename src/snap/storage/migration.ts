// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import { IMigration, StorageData, V0StorageData, V1StorageData } from "./types"

export class Migration implements IMigration {
  #storageData: StorageData;
  #latestVersion: number;

  constructor(storageData: StorageData, version: number) {
    this.#storageData = storageData;
    this.#latestVersion = version;
  };

  #getV1StorageData = (): V1StorageData => {
    return this.#storageData as V1StorageData;
  }

  #migrateV0toV1 = (data: V0StorageData): V1StorageData => {
    return { ...data, version: 1 };
  }

  #getVersion = () => {
    try {
      //@ts-ignore
      return this.data.version as number;
    }
    catch (e) { return 0; }
  }

  #migrate = () => {
    const currentVersion = this.#getVersion()

    if (currentVersion === this.#latestVersion) return;

    switch (currentVersion) {
      case 0: this.#migrateV0toV1;
      // case 1 : this.migrateV1toV2;
      // case 2 : this.migrateV2toV3;
    }
  }

  public getStorageData = () => {
    this.#migrate();
    return this.#getV1StorageData();
  }
}