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
	TssRunRePairing = 'tss_runRePairing',
	TssUpdateSnap = 'tss_updateSnap',
	E2eTestGetKeyShare = 'e2e_test_getKeyShare',
}

export enum SigningMethods {
	SignTransaction = 'sign_transaction',
	SignTypedData = 'eth_signTypedData',
	SignPersonalMessage = 'personal_sign',
	EthSign = 'eth_sign',
}

export const DAPP_URL_PROD = 'https://snap.silencelaboratories.com';
export const DAPP_URL_STAGING = 'https://snap-staging.silencelaboratories.com';

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
	[
		DAPP_URL_PROD,
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
			InternalMethod.TssRunRePairing,
			InternalMethod.TssUpdateSnap,
		],
	],
]);

/** THIS SHOULD BE USED FOR DEVELOPMENT ONLY */
export const STAGING_PERMISSIONS = new Map<string, string[]>([
	[
		DAPP_URL_STAGING,
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
			InternalMethod.TssRunRePairing,
			InternalMethod.TssUpdateSnap,
			InternalMethod.E2eTestGetKeyShare,
		],
	],
	[
		'http://localhost:3000',
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
			InternalMethod.TssInitPairing,
			InternalMethod.TssIsPaired,
			InternalMethod.TssRunPairing,
			InternalMethod.TssRunRePairing,
			InternalMethod.TssRunKeygen,
			InternalMethod.TssSnapVersion,
			InternalMethod.TssUnPair,
			InternalMethod.TssUpdateSnap,
		],
	],
	[
		'http://localhost:8080',
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
			InternalMethod.TssInitPairing,
			InternalMethod.TssIsPaired,
			InternalMethod.TssRunPairing,
			InternalMethod.TssRunRePairing,
			InternalMethod.TssRunKeygen,
			InternalMethod.TssSnapVersion,
			InternalMethod.TssUnPair,
			InternalMethod.TssUpdateSnap,
		],
	],
]);
