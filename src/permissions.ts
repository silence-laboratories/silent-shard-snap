// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import { KeyringRpcMethod } from '@metamask/keyring-api';

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
			KeyringRpcMethod.ListAccounts,
			KeyringRpcMethod.GetAccount,
			KeyringRpcMethod.CreateAccount,
			KeyringRpcMethod.FilterAccountChains,
			KeyringRpcMethod.UpdateAccount,
			KeyringRpcMethod.DeleteAccount,
			KeyringRpcMethod.ListRequests,
			KeyringRpcMethod.GetRequest,
			KeyringRpcMethod.ApproveRequest,
			KeyringRpcMethod.SubmitRequest,
			KeyringRpcMethod.RejectRequest,
		],
	],
	// [
	// 	'http://localhost:3000',
	// 	[
	// 		KeyringRpcMethod.ListAccounts,
	// 		KeyringRpcMethod.GetAccount,
	// 		KeyringRpcMethod.CreateAccount,
	// 		KeyringRpcMethod.FilterAccountChains,
	// 		KeyringRpcMethod.UpdateAccount,
	// 		KeyringRpcMethod.DeleteAccount,
	// 		KeyringRpcMethod.ListRequests,
	// 		KeyringRpcMethod.GetRequest,
	// 		KeyringRpcMethod.ApproveRequest,
	// 		KeyringRpcMethod.SubmitRequest,
	// 		KeyringRpcMethod.RejectRequest,
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
	// 		KeyringRpcMethod.ListAccounts,
	// 		KeyringRpcMethod.GetAccount,
	// 		KeyringRpcMethod.CreateAccount,
	// 		KeyringRpcMethod.FilterAccountChains,
	// 		KeyringRpcMethod.UpdateAccount,
	// 		KeyringRpcMethod.DeleteAccount,
	// 		KeyringRpcMethod.ListRequests,
	// 		KeyringRpcMethod.GetRequest,
	// 		KeyringRpcMethod.ApproveRequest,
	// 		KeyringRpcMethod.SubmitRequest,
	// 		KeyringRpcMethod.RejectRequest,
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
			KeyringRpcMethod.ListAccounts,
			KeyringRpcMethod.GetAccount,
			KeyringRpcMethod.CreateAccount,
			KeyringRpcMethod.DeleteAccount,
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
			KeyringRpcMethod.ListAccounts,
			KeyringRpcMethod.GetAccount,
			KeyringRpcMethod.CreateAccount,
			KeyringRpcMethod.DeleteAccount,
			InternalMethod.TssInitPairing,
			InternalMethod.TssIsPaired,
			InternalMethod.TssRunPairing,
			InternalMethod.TssRunKeygen,
			InternalMethod.TssSnapVersion,
			InternalMethod.TssUnPair,
		],
	],
]);
