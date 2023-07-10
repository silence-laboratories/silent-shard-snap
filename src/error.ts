export class SnapError extends Error {
	code: number;
	constructor(message: string, code: SnapErrorCode) {
		super(JSON.stringify({ message, code }));
		this.name = 'SnapError';
		this.code = code;
	}
}

export enum SnapErrorCode {
	FirebaseError = 1,
	NotPaired = 2,
	RejectedRequest = 3,
	AlreadyPaired = 4,
	UnknownMethod = 5,
	ResourceBusy = 6,
	UnknownError = 7,
	InvalidData = 8,
	WalletNotCreated = 9,
	UserPhoneDenied = 10,
	NoDistributedKeyFound = 11,
	InternalLibError = 12,
	InvalidMessageHashLength = 13,
	PairingNotInitialized = 14,
	StorageError = 15,
	UnknownTxnType = 16,
	InvalidBackupData = 17,
	BackupFailed = 18,
	KeygenFailed = 19,
	SignFailed = 20,
}
