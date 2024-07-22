import { RequestOptions, SnapRequest } from "@metamask/snaps-jest";
import { DEVICE_NAME, INIT_PAIR_PANEL_DESCRIPTION, INIT_PAIR_PANEL_HEADING, STAGING_ORIGIN } from "./constants";
import { InternalMethod } from "../permissions";
import { DialogType } from "@metamask/snaps-types";
import { panel, heading, divider, text } from "@metamask/snaps-ui";
import { StorageData } from "../snap/types";
import SnapSDK from "../snap/sdk";
import { MockStorage } from "./mockStorage";
import { Signer } from "./signerVerifier";
import SimpleKeyring from '../snap/keyring';

export class SnapRepository {
  #request: (request: RequestOptions) => SnapRequest;
  #walletAddress: string | null = null;

  constructor(request: (request: RequestOptions) => SnapRequest) {
    this.#request = request;
  }

  isPaired = async () => {
    const response = this.#request({
      method: InternalMethod.TssIsPaired,
      origin: STAGING_ORIGIN,
    });

    expect(await response).toRespondWith({
      isPaired: false,
      deviceName: null,
    });
  }

  unPair = async () => {
    await this.#request({
      method: InternalMethod.TssUnPair,
      origin: STAGING_ORIGIN,
    });
  }

  initPairing = async (isRePair: boolean = false) => {
    const initPairingReq = this.#request({
      method: InternalMethod.TssInitPairing,
      origin: STAGING_ORIGIN,
      params: [{ isRePair: isRePair }],
    });

    if (!isRePair) {
      const ui = await initPairingReq.getInterface();
      expect(ui.type).toBe(DialogType.Confirmation);
      const prompt = INIT_PAIR_PANEL_HEADING;
      const description = INIT_PAIR_PANEL_DESCRIPTION;
      expect(ui).toRender(
        panel([
          heading(prompt),
          divider(),
          ...description.map((t) => text(t)),
        ]),
      );

      await ui.ok();
    }

    const initPairingJson: any = (await initPairingReq).response;
    const initPairingResult =
      initPairingJson.result as InitPairingResponse;
    const qrCode = initPairingResult.qrCode;
    const qrCodeObj = JSON.parse(qrCode) as QrCode;

    expect(qrCodeObj.pairingId).toEqual(expect.any(String));
    expect(qrCodeObj.webEncPublicKey).toEqual(expect.any(String));
    expect(qrCodeObj.signPublicKey).toEqual(expect.any(String));

    return qrCodeObj;
  }

  runPairing = async () => {
    const runPairingReq = this.#request({
      method: InternalMethod.TssRunPairing,
      origin: STAGING_ORIGIN,
    });

    const runPairingJson: any = (await runPairingReq).response;
    const runPairingResult =
      runPairingJson.result as RunPairingResponse;
    expect(runPairingResult.deviceName).toEqual(DEVICE_NAME);
    expect(runPairingResult.address).toBeNull();
  }

  runKeygen = async () => {
    const keygenReq = this.#request({
      method: InternalMethod.TssRunKeygen,
      origin: STAGING_ORIGIN,
    });
    const keyGenJson: any = (await keygenReq).response;
    const runKeyGenResult = keyGenJson.result as RunKeygenResponse;
    expect(runKeyGenResult.address).toEqual(expect.any(String));
    this.#walletAddress = runKeyGenResult.address;
  }

  runBackup = async () => {
    const backupReq = this.#request({
      method: InternalMethod.TssRunBackup,
      origin: STAGING_ORIGIN,
    });
    await backupReq;
  }

  getStorage = async () => {
    const snapStorageReq = this.#request({
      method: InternalMethod.E2eTestGetStorage,
      origin: STAGING_ORIGIN,
    });
    const snapStorageReqJson: any = (await snapStorageReq).response;
    const snapStorageData = snapStorageReqJson.result as StorageData;
    return snapStorageData;
  }

  runSign = async () => {
    if (!this.#walletAddress) throw new Error('Do keygen before sign');

    const snapStorageData = await this.getStorage();
    const mockStorage = new MockStorage(snapStorageData);
    const snapSdk = await SnapSDK.instance(mockStorage);
    const keyring = new SimpleKeyring(snapStorageData, mockStorage, snapSdk);
    const signer = new Signer(keyring, this.#walletAddress);
    await signer.signAndVerifyEip1559Tx();
    await signer.signPersonalSign();
    await signer.signAndVerifyLegacyTx();
    await signer.signAndVerifySignTypedDataV1();
    await signer.signAndVerifySignTypedDataV3();
    await signer.signAndVerifySignTypedDataV4();
  }

  runRePairing = async (newAccounAddress?: string) => {
    if (!this.#walletAddress) throw new Error('Do keygen before sign');
    const runRePairingReq = this.#request({
      method: InternalMethod.TssRunRePairing,
      origin: STAGING_ORIGIN,
    });

    const runRePairingJson: any = (await runRePairingReq).response;
    const runRePairingResult = runRePairingJson.result as RunRePairingResponse;

    expect(newAccounAddress ?? this.#walletAddress).toEqual(runRePairingResult.newAccountAddress);
  }
}