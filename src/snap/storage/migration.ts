// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import { IMigration, StorageData, V0StorageData, V1StorageData } from "./types"

export class Migration implements IMigration {
  private storageData: StorageData;
  private latestVersion;

  constructor(storageData: StorageData, version: number) {
    this.storageData = storageData;
    this.latestVersion = 2;
  };

  private getV1StorageData = (): V1StorageData => {
    return this.storageData as V1StorageData;
  }

  private migrateV0toV1 = (data: V0StorageData): V1StorageData => {
    return { ...data, version: 1 };
  }

  private getVersion = () => {
    try {
      //@ts-ignore
      return this.data.version as number;
    }
    catch (e) { return 0; }
  }

  private migrate = () => {
    const migrationMap = {
      'V0toV1': this.migrateV0toV1,
      // Next few elements in migrationMap will look like.
      // 'V1toV2': this.migrateV1toV2,
      // 'V2toV3' : this.migrateV2toV3,
    }
    let version = this.getVersion()

    if (version === this.latestVersion) throw new Error('Migration failed, already up to date');


    for (; version < this.latestVersion; version++) {
      let v = `V${version}toV${version + 1}` as keyof typeof migrationMap;
      this.storageData = migrationMap[v]!(this.storageData);
    }
  }

  public getStorageData = () => {
    this.migrate();
    return this.getV1StorageData();
  }
}