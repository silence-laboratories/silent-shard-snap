interface InitPairingResponse {
	qrCode: string;
}

interface IsPairedResponse {
	isPaired: boolean;
	deviceName: string;
	isAccountExist: boolean;
}

interface RunPairingResponse {
	address: string | null;
	deviceName: string;
}

interface RunKeygenResponse {
	address: string;
}

interface SnapVersionResponse {
	currentVersion: string;
	latestVersion: string;
}

type RunSign = (
    hashAlg: string,
    message: string,
    messageHashHex: string,
    signMetadata: SignMetadata,
    accountId: number,
    keyShare: IP1KeyShare,
) => Promise<any>; 