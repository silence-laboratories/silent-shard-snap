// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import {
	Keyring,
	KeyringAccount,
	KeyringEvent,
	KeyringRequest,
	SubmitRequestResponse,
	emitSnapKeyringEvent,
} from '@metamask/keyring-api';
import {
	stripHexPrefix,
	hashPersonalMessage,
	bufArrToArr,
} from '@ethereumjs/util';
import type { Json } from '@metamask/utils';
import {
	DistributedKey,
	KeyringState,
	SignMetadata,
	StorageData,
	Wallet,
} from '../types';
import {
	deleteStorage,
	getSilentShareStorage,
	saveSilentShareStorage,
} from './storage';
import { runSign } from './sdk';
import { Common, Hardfork } from '@ethereumjs/common';
import { TransactionFactory } from '@ethereumjs/tx';
import { getAddressFromDistributedKey, isEvmChain, toHexString } from './utils';
import { JsonRpcRequest } from '@metamask/snaps-types';
import keccak256 from 'keccak256';
import {
	SignTypedDataVersion,
	TypedDataUtils,
	typedSignatureHash,
} from '@metamask/eth-sig-util';
import { SnapError, SnapErrorCode } from '../error';
import { RLP } from '@ethereumjs/rlp';
import { InvalidRequestError } from '@metamask/snaps-sdk';
import type { SnapsGlobalObject } from '@metamask/snaps-rpc-methods';

export class SimpleKeyring implements Keyring {
	#wallets: Record<string, Wallet>;
	#requests: Record<string, KeyringRequest>;

	constructor(state: KeyringState) {
		this.#wallets = state.wallets;
		this.#requests = state.requests;
	}

	async listAccounts(): Promise<KeyringAccount[]> {
		return Object.values(this.#wallets).map((wallet) => wallet.account);
	}

	async getAccount(id: string): Promise<KeyringAccount | undefined> {
		throw new Error(
			'The "getAccount" method is not available on this snap.',
		);
	}

	async createAccount(
		options: Record<string, Json> = {},
	): Promise<KeyringAccount> {
		let silentShareStorage: StorageData = await getSilentShareStorage();
		const newPairingState = silentShareStorage.newPairingState;
		if (!newPairingState?.distributedKey || !newPairingState.accountId) {
			throw new SnapError(
				'Do keygen before creating account',
				SnapErrorCode.WalletNotCreated,
			);
		}

		let distributedKey: DistributedKey = newPairingState.distributedKey;
		let account: KeyringAccount;
		const address = getAddressFromDistributedKey(distributedKey);

		account = {
			id: newPairingState.accountId,
			options,
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

		try {
			await this.#emitEvent(KeyringEvent.AccountCreated, { account });
			this.#wallets[account.id] = {
				account,
				distributedKey,
			};
			await this.#saveState();
			return account;
		} catch (error) {
			const errorWithType = error as { code: number; message: string };
			if (errorWithType.message.includes('already exists')) {
				this.#wallets[account.id] = {
					account,
					distributedKey,
				};
				await this.#saveState();
				return account;
			} else if (errorWithType.message.includes('already pending')) {
				throw new SnapError(
					'Request is already running',
					SnapErrorCode.AccountNotCreated,
				);
			} else {
				throw new SnapError(
					'User rejected request for account creation',
					SnapErrorCode.AccountNotCreated,
				);
			}
		}
	}

	async filterAccountChains(
		_id: string,
		chains: string[],
	): Promise<string[]> {
		// The `id` argument is not used because all accounts created by this snap
		// are expected to be compatible with any EVM chain.2
		return chains.filter((chain) => isEvmChain(chain));
	}

	async updateAccount(account: KeyringAccount): Promise<void> {
		const wallet = this.#wallets[account.id];
		if (!wallet)
			throw new SnapError(
				'Wallet does not exist',
				SnapErrorCode.WalletNotCreated,
			);
		const currentAccount = wallet.account;
		const newAccount: KeyringAccount = {
			...currentAccount,
			...account,
			// Restore read-only properties.
			address: currentAccount.address,
			methods: currentAccount.methods,
			type: currentAccount.type,
			options: currentAccount.options,
		};

		wallet.account = newAccount;
		await this.#saveState();

		await this.#emitEvent(KeyringEvent.AccountUpdated, { account });
	}

	async deleteAccount(id: string): Promise<void> {
		let silentShareStorage: StorageData = await getSilentShareStorage();
		await this.#emitEvent(KeyringEvent.AccountDeleted, { id });
		delete this.#wallets[id];
		if (
			silentShareStorage.newPairingState?.pairingData &&
			silentShareStorage.newPairingState?.pairingData?.pairingId !==
				silentShareStorage.pairingData.pairingId
		)
			await saveSilentShareStorage({
				...silentShareStorage,
				pairingData: silentShareStorage.newPairingState.pairingData,
				wallets: this.#wallets,
				requests: this.#requests,
			});
		else deleteStorage();
	}

	async listRequests(): Promise<KeyringRequest[]> {
		return Object.values(this.#requests);
	}

	async getRequest(id: string): Promise<KeyringRequest> {
		throw new Error(
			'The "getRequest" method is not available on this snap.',
		);
	}

	async submitRequest(
		request: KeyringRequest,
	): Promise<SubmitRequestResponse> {
		try {
			const { method, params } = request.request as JsonRpcRequest;
			if (params == null) {
				throw new SnapError(
					'Invalid params',
					SnapErrorCode.UnknownError,
				);
			}
			const signature = await this.#handleSigningRequest(method, params);
			return {
				pending: false,
				result: signature,
			};
		} catch (error) {
			const errorMessage = (
				JSON.parse((error as SnapError).message) as {
					message: string;
					code: SnapErrorCode;
				}
			).message;
			throw new InvalidRequestError(errorMessage);
		}
	}

	async approveRequest(_id: string): Promise<void> {
		throw new Error(
			'The "approveRequest" method is not available on this snap.',
		);
	}

	async rejectRequest(_id: string): Promise<void> {
		throw new Error(
			'The "rejectRequest" method is not available on this snap.',
		);
	}

	#getWalletByAddress(address: string): Wallet {
		const walletMatch = Object.values(this.#wallets).find(
			(wallet) =>
				wallet.account.address.toLowerCase() === address.toLowerCase(),
		);

		if (walletMatch === undefined) {
			throw new SnapError(
				`Cannot find wallet for address: ${address}`,
				SnapErrorCode.CannotFindWallet,
			);
		}
		return walletMatch;
	}

	async #handleSigningRequest(method: string, params: Json): Promise<Json> {
		switch (method) {
			case 'personal_sign': {
				const [message, from] = params as [string, string];
				return this.signPersonalMessage(from, message, runSign);
			}

			case 'eth_sendTransaction':
			case 'eth_signTransaction':
			case 'sign_transaction': {
				const [tx] = params as [Json];
				return await this.signTransaction(tx, runSign);
			}

			case 'eth_signTypedData_v1': {
				const [from, data, opts] = params as [
					string,
					Json,
					{ version: SignTypedDataVersion },
				];
				return this.signTypedData(from, data, opts, method, runSign);
			}
			case 'eth_signTypedData_v3': {
				const [from, data] = params as [string, Json];
				return this.signTypedData(
					from,
					data,
					{ version: SignTypedDataVersion.V3 },
					method,
					runSign
				);
			}
			case 'eth_signTypedData_v4': {
				const [from, data] = params as [string, Json];
				return this.signTypedData(
					from,
					data,
					{ version: SignTypedDataVersion.V4 },
					method,
					runSign
				);
			}

			case 'eth_sign': {
				const [from, data] = params as [string, string];
				return this.signMessage(from, data, runSign);
			}

			default: {
				throw new Error(`EVM method not supported: ${method}`);
			}
		}
	}

	async signTransaction(tx: any, runTssSign: RunSign): Promise<string> {
		const { from } = tx;
		// Patch the transaction to make sure that the `chainId` is a hex string.
		if (!tx.chainId.startsWith('0x')) {
			tx.chainId = `0x${parseInt(tx.chainId, 10).toString(16)}`;
		}

		const common = Common.custom(
			{ chainId: tx.chainId },
			{
				hardfork:
					tx.maxPriorityFeePerGas || tx.maxFeePerGas
						? Hardfork.London
						: Hardfork.Istanbul,
			},
		);

		const tx1 = TransactionFactory.fromTxData(tx, {
			common,
		});
		const msg = tx1.getMessageToSign(false);
		// If tx1.type = 1, then it is a legacy txn, and we have to do RLP encoding manually, following code do this.
		const serializedMessage =
			tx1.type == 0
				? Buffer.from(RLP.encode(bufArrToArr(msg))).toString('hex')
				: msg.toString('hex');
		const hashedMsg = tx1.getMessageToSign(true).toString('hex');

		const wallet = this.#getWalletByAddress(from);

		const transactionMetadata: SignMetadata =
			tx1.type == 0 ? 'legacy_transaction' : 'eth_transaction';

		const { signature, recId } = await runTssSign(
			'keccak256',
			serializedMessage,
			hashedMsg,
			transactionMetadata,
			wallet.distributedKey.accountId,
			wallet.distributedKey.keyShareData,
		);
		const r = signature.slice(0, 64);
		const s = signature.slice(64, 128);

		// Calculating recId based on txn type, Legacy or EIP 1559
		const v =
			'0x' +
			(tx1.type == 0
				? Number(tx.chainId) * 2 + 35 + recId
				: recId
			).toString(16);

		const serializedTx = {
			...tx,
			v: v,
			r: '0x' + r,
			s: '0x' + s,
		};
		return serializedTx;
	}

	async signTypedData(
		from: string,
		data: Json,
		opts: { version: SignTypedDataVersion } = {
			version: SignTypedDataVersion.V1,
		},
		method: SignMetadata,
		runTssSign: RunSign
	): Promise<string> {
		const wallet = this.#getWalletByAddress(from);
		const messageHash =
			opts.version === SignTypedDataVersion.V1
				? typedSignatureHash(data as any)
				: TypedDataUtils.eip712Hash(data as any, opts.version).toString(
						'hex',
				  );
		const { signature, recId } = await runTssSign(
			'none',
			messageHash,
			messageHash,
			method,
			wallet.distributedKey.accountId,
			wallet.distributedKey.keyShareData,
		);
		return '0x' + signature + (recId + 27).toString(16);
	}

	async signPersonalMessage(from: string, request: string, runTssSign: RunSign): Promise<string> {
		const messageHash = toHexString(
			hashPersonalMessage(Buffer.from(request.slice(2), 'hex')),
		);
		const wallet = this.#getWalletByAddress(from);

		const { signature, recId } = await runTssSign(
			'keccak256',
			request,
			messageHash,
			'personal_sign',
			wallet.distributedKey.accountId,
			wallet.distributedKey.keyShareData,
		);
		return '0x' + signature + (recId + 27).toString(16);
	}

	async signMessage(from: string, data: string, runTssSign: RunSign): Promise<string> {
		const message = stripHexPrefix(data);
		const messageHash = keccak256('0x' + message).toString('hex');
		const wallet = this.#getWalletByAddress(from);
		const { signature, recId } = await runTssSign(
			'keccak256',
			message,
			messageHash,
			'eth_sign',
			wallet.distributedKey.accountId,
			wallet.distributedKey.keyShareData,
		);
		return '0x' + signature + (recId + 27).toString(16);
	}

	async #saveState(): Promise<void> {
		let silentShareStorage: StorageData = await getSilentShareStorage();
		await saveSilentShareStorage({
			...silentShareStorage,
			wallets: this.#wallets,
			requests: this.#requests,
		});
	}
	async #emitEvent(
		event: KeyringEvent,
		data: Record<string, Json>,
	): Promise<void> {
		await emitSnapKeyringEvent(snap as SnapsGlobalObject, event, data);
	}
}
