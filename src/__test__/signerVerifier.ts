import { Eip1559Tx, LegacyTx, genMockEip1559Tx, genMockLegacyTx, mockPersonalMsg, mockSignTypedDataV1, mockSignTypedDataV3, mockSignTypedDataV4 } from "./mocks";
import SimpleKeyring from '../snap/keyring';
import * as utils from '../snap/utils/utils';
import { Common, Hardfork } from "@ethereumjs/common";
import { TransactionFactory } from "@ethereumjs/tx";
import { SignTypedDataVersion, recoverPersonalSignature, recoverTypedSignature } from "@metamask/eth-sig-util";

export class Signer {
  #keyring: SimpleKeyring;
  #walletAddress: string;

  constructor(keyring: SimpleKeyring, walletAddress: string) {
    this.#keyring = keyring;
    this.#walletAddress = walletAddress;
  }

  signPersonalSign = async () => {
    let personalSignResult: string | null = null;
    this.#keyring
      .signPersonalMessage(this.#walletAddress, mockPersonalMsg)
      .then((resp: string) => {
        personalSignResult = resp;
      })
      .catch((err) => {
        console.log('err', err);
      });
    while (!personalSignResult) {
      // to wait for keyring sign result, if we remove this the thread will be blocked
      await utils.delay(0);
    }

    expect(personalSignResult).toEqual(expect.any(String));
    expect(personalSignResult).toMatch(/^0x/);

    const recoveredAddr = recoverPersonalSignature({
      data: mockPersonalMsg,
      signature: personalSignResult,
    });

    expect(recoveredAddr).toEqual(this.#walletAddress);
  }

  signAndVerifyEip1559Tx = async () => {
    let eip1559SignResult: Eip1559Tx | null = null;
    const mockEip1559Tx: Eip1559Tx = genMockEip1559Tx(this.#walletAddress);
    this.#keyring
      .signTransaction(mockEip1559Tx)
      .then((resp: any) => {
        eip1559SignResult = resp;
      })
      .catch((err) => {
        console.log('err', err);
      });

    while (!eip1559SignResult) {
      // to wait for keyring sign result, if we remove this the thread will be blocked
      await utils.delay(0);
    }
    for (const key in mockEip1559Tx) {
      if (Object.prototype.hasOwnProperty.call(mockEip1559Tx, key)) {
        expect(eip1559SignResult[key]).toEqual(mockEip1559Tx[key]);
      }
    }

    const common = Common.custom(
      { chainId: parseInt((eip1559SignResult as Eip1559Tx).chainId, 16) },
      {
        hardfork:
          (eip1559SignResult as Eip1559Tx).maxPriorityFeePerGas ||
            (eip1559SignResult as Eip1559Tx).maxFeePerGas
            ? Hardfork.London
            : Hardfork.Istanbul,
      },
    );
    let eip1559tx = TransactionFactory.fromTxData(eip1559SignResult, {
      common,
    });
    expect(eip1559tx.verifySignature()).toEqual(true);
  }

  signAndVerifyLegacyTx = async () => {
    let legacySignResult: LegacyTx | null = null;
    const mockLegacyTx: LegacyTx = genMockLegacyTx(this.#walletAddress);
    this.#keyring
      .signTransaction(mockLegacyTx)
      .then((resp: any) => {
        legacySignResult = resp;
      })
      .catch((err) => {
        console.log('err', err);
      });

    while (!legacySignResult) {
      // to wait for keyring sign result, if we remove this the thread will be blocked
      await utils.delay(0);
    }

    for (const key in mockLegacyTx) {
      if (Object.prototype.hasOwnProperty.call(mockLegacyTx, key)) {
        expect(legacySignResult[key]).toEqual(mockLegacyTx[key]);
      }
    }

    const commonLegacy = Common.custom(
      { chainId: parseInt((legacySignResult as LegacyTx).chainId, 16) },
      {
        hardfork:
          (legacySignResult as LegacyTx).maxPriorityFeePerGas ||
            (legacySignResult as LegacyTx).maxFeePerGas
            ? Hardfork.London
            : Hardfork.Istanbul,
      },
    );
    let legacyTx = TransactionFactory.fromTxData(legacySignResult, {
      common: commonLegacy,
    });
    expect(legacyTx.verifySignature()).toEqual(true);
  }

  signAndVerifySignTypedDataV4 = async () => {
    let typedV4SignResult: string | null = null;

    this.#keyring
      .signTypedData(
        this.#walletAddress,
        mockSignTypedDataV4,
        { version: SignTypedDataVersion.V4 },
        'eth_signTypedData_v4',
      )
      .then((resp: string) => {
        typedV4SignResult = resp;
      })
      .catch((err) => {
        console.log('err', err);
      });
    while (!typedV4SignResult) {
      // to wait for keyring sign result, if we remove this the thread will be blocked
      await utils.delay(0);
    }
    expect(typedV4SignResult).toEqual(expect.any(String));
    expect(typedV4SignResult).toMatch(/^0x/);

    const v4RecoveredAddr = recoverTypedSignature({
      data: mockSignTypedDataV4 as any,
      signature: typedV4SignResult,
      version: SignTypedDataVersion.V4,
    });

    expect(v4RecoveredAddr).toEqual(this.#walletAddress);
  }

  signAndVerifySignTypedDataV3 = async () => {
    let typedV3SignResult: string | null = null;

    this.#keyring
      .signTypedData(
        this.#walletAddress,
        mockSignTypedDataV3,
        { version: SignTypedDataVersion.V3 },
        'eth_signTypedData_v3',
      )
      .then((resp: string) => {
        typedV3SignResult = resp;
      })
      .catch((err) => {
        console.log('err', err);
      });
    while (!typedV3SignResult) {
      // to wait for keyring sign result, if we remove this the thread will be blocked
      await utils.delay(0);
    }
    expect(typedV3SignResult).toEqual(expect.any(String));
    expect(typedV3SignResult).toMatch(/^0x/);

    const v3RecoveredAddr = recoverTypedSignature({
      data: mockSignTypedDataV3 as any,
      signature: typedV3SignResult,
      version: SignTypedDataVersion.V3,
    });

    expect(v3RecoveredAddr).toEqual(this.#walletAddress);
  }

  signAndVerifySignTypedDataV1 = async () => {
    let typedV1SignResult: string | null = null;

    this.#keyring
      .signTypedData(
        this.#walletAddress,
        mockSignTypedDataV1,
        { version: SignTypedDataVersion.V1 },
        'eth_signTypedData_v1',
      )
      .then((resp: string) => {
        typedV1SignResult = resp;
      })
      .catch((err) => {
        console.log('err', err);
      });
    while (!typedV1SignResult) {
      // to wait for keyring sign result, if we remove this the thread will be blocked
      await utils.delay(0);
    }
    expect(typedV1SignResult).toEqual(expect.any(String));
    expect(typedV1SignResult).toMatch(/^0x/);

    const v1RecoveredAddr = recoverTypedSignature({
      data: mockSignTypedDataV1,
      signature: typedV1SignResult,
      version: SignTypedDataVersion.V1,
    });

    expect(v1RecoveredAddr).toEqual(this.#walletAddress);
  }

}