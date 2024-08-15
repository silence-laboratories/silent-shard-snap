import { KeyringAccount } from "@metamask/keyring-api";
import { DistributedKey, IStorage, StorageData } from "../snap/types";
import * as utils from '../snap/utils/utils';

export class MockStorage implements IStorage {
  #storageData: StorageData;
  #VERSION = 1;

  constructor(storageData: StorageData) {
    this.#storageData = storageData;
    this.#convertStorage();
  }

  #convertStorage = () => {
    const newPairingState = this.#storageData.newPairingState;
    if (!newPairingState?.distributedKey || !newPairingState.accountId)
      throw new Error('Do keygen before creating account',);

    const distributedKey: DistributedKey = newPairingState.distributedKey;
    const address = utils.getAddressFromDistributedKey(distributedKey);

    const account: KeyringAccount = {
      id: newPairingState.accountId,
      options: {},
      address,
      methods: [
        'eth_sign',
        'eth_signTransaction',
        'eth_signTypedData_v1',
        'eth_signTypedData_v3',
        'eth_signTypedData_v4',
        'personal_sign',
      ],
      type: 'eip155:eoa',
    };

    this.#storageData.wallets[account.id] = {
      account,
      distributedKey,
    };
  }

  setStorageData = async (data: Omit<StorageData, "version">): Promise<void> => {
    this.#storageData = { ...data, version: this.#VERSION };
  }

  getStorageData = async (): Promise<StorageData> => {
    return this.#storageData;
  }

  clearStorageData = (): Promise<void> => {
    throw new Error('clearStorageData function not implemented in MockStorage');
  }
}