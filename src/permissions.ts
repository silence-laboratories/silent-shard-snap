export enum SnapKeyringMethod {
	ListAccounts = 'keyring_listAccounts',
	CreateAccount = 'keyring_createAccount',
	GetAccount = 'keyring_getAccount',
	UpdateAccount = 'keyring_updateAccount',
	DeleteAccount = 'keyring_deleteAccount',
	ExportAccount = 'keyring_exportAccount',
}

export enum RequestMethods {
	GetRequest = 'keyring_getRequest',
	SubmitRequest = 'keyring_submitRequest',
	ListRequests = 'keyring_listRequests',
	DeleteRequest = 'keyring_deleteRequest',
	ApproveRequest = 'keyring_approveRequest',
	RejectRequest = 'keyring_rejectRequest',
}

export enum InternalMethod {
	TssIsPaired = 'tss_isPaired',
	TssInitPairing = 'tss_initPairing',
	TssRunPairing = 'tss_runPairing',
	TssRunKeygen = 'tss_runKeygen',
	TssUnPair = 'tss_unpair',
	TssSnapVersion = 'tss_snapVersion',
}

export enum SigningMethods {
	SignTransaction = 'sign_transaction',
	SignTypedData = 'eth_signTypedData',
	SignPersonalMessage = 'personal_sign',
	EthSign = 'eth_sign',
}

export const PERMISSIONS = new Map<string, string[]>([
	[
		'metamask',
		[
			SnapKeyringMethod.ListAccounts,
			SnapKeyringMethod.CreateAccount,
			SnapKeyringMethod.DeleteAccount,
			SnapKeyringMethod.UpdateAccount,
			RequestMethods.ListRequests,
			RequestMethods.SubmitRequest,
			RequestMethods.ApproveRequest,
			RequestMethods.RejectRequest,
		],
	],
	// [
	// 	'http://localhost:3000',
	// 	[
	// 		SnapKeyringMethod.ListAccounts,
	// 		SnapKeyringMethod.CreateAccount,
	// 		SnapKeyringMethod.GetAccount,
	// 		SnapKeyringMethod.UpdateAccount,
	// 		SnapKeyringMethod.DeleteAccount,
	// 		SnapKeyringMethod.ExportAccount,
	// 		RequestMethods.ListRequests,
	// 		RequestMethods.ApproveRequest,
	// 		RequestMethods.DeleteRequest,
	// 		RequestMethods.RejectRequest,
	// 		RequestMethods.GetRequest,
	// 		InternalMethod.TssInitPairing,
	// 		InternalMethod.TssIsPaired,
	// 		InternalMethod.TssRunPairing,
	// 		InternalMethod.TssRunKeygen,
	// 		InternalMethod.TssSnapVersion,
	// 		InternalMethod.TssUnPair,
	// 	],
	// ],
	// [
	// 	'http://localhost:8080',
	// 	[
	// 		SnapKeyringMethod.ListAccounts,
	// 		SnapKeyringMethod.CreateAccount,
	// 		SnapKeyringMethod.GetAccount,
	// 		SnapKeyringMethod.UpdateAccount,
	// 		SnapKeyringMethod.DeleteAccount,
	// 		SnapKeyringMethod.ExportAccount,
	// 		RequestMethods.ListRequests,
	// 		RequestMethods.ApproveRequest,
	// 		RequestMethods.DeleteRequest,
	// 		RequestMethods.RejectRequest,
	// 		RequestMethods.GetRequest,
	// 		InternalMethod.TssInitPairing,
	// 		InternalMethod.TssIsPaired,
	// 		InternalMethod.TssRunPairing,
	// 		InternalMethod.TssRunKeygen,
	// 		InternalMethod.TssSnapVersion,
	// 		InternalMethod.TssUnPair,
	// 	],
	// ],
	[
		'https://snap.silencelaboratories.com',
		[
			SnapKeyringMethod.ListAccounts,
			SnapKeyringMethod.CreateAccount,
			SnapKeyringMethod.GetAccount,
			SnapKeyringMethod.DeleteAccount,
			InternalMethod.TssInitPairing,
			InternalMethod.TssIsPaired,
			InternalMethod.TssRunPairing,
			InternalMethod.TssRunKeygen,
			InternalMethod.TssSnapVersion,
			InternalMethod.TssUnPair,
		],
	],
	[
		'https://snap-staging.silencelaboratories.com',
		[
			SnapKeyringMethod.ListAccounts,
			SnapKeyringMethod.CreateAccount,
			SnapKeyringMethod.GetAccount,
			SnapKeyringMethod.DeleteAccount,
			InternalMethod.TssInitPairing,
			InternalMethod.TssIsPaired,
			InternalMethod.TssRunPairing,
			InternalMethod.TssRunKeygen,
			InternalMethod.TssSnapVersion,
			InternalMethod.TssUnPair,
		],
	],
]);
