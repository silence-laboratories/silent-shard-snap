import { OnRpcRequestHandler } from '@metamask/snaps-types';
import * as sdk from './snap/sdk';
import { isStorageExist } from './snap/storage';
import { isPaired } from './snap/sdk';
import { panel, text, heading, divider } from '@metamask/snaps-ui';
import { sign } from 'crypto';
import { SnapError, SnapErrorCode } from './error';
import { NestedUint8Array, RLP } from '@ethereumjs/rlp';
import { toHexString } from './snap/utils';

async function showConfirmationMessage(
	prompt: string,
	description: string,
	textAreaContent: string,
) {
	return await snap.request({
		method: 'snap_dialog',
		params: {
			type: 'confirmation',
			content: panel([
				heading(prompt),
				divider(),
				text(description),
				text(textAreaContent),
			]),
		},
	});
}

async function showTxnConfirmationMessage(
	prompt: string,
	description: string,
	textAreaContent: string[],
) {
	return await snap.request({
		method: 'snap_dialog',
		params: {
			type: 'confirmation',
			content: panel([
				heading(prompt),
				divider(),
				text(description),
				...textAreaContent.map((txt) => text(txt)),
				divider(),
			]),
		},
	});
}

async function checkIfPaired() {
	let cond = await isStorageExist();
	if (!cond) {
		throw new SnapError('Not paired yet', SnapErrorCode.NotPaired);
	}
}

export const onRpcRequest: OnRpcRequestHandler = async ({
	origin,
	request,
}) => {
	let public_key, hash_alg, message, message_hash;
	switch (request.method) {
		case 'tss_isPaired':
			return await isPaired();

		case 'tss_unpair':
			await checkIfPaired();
			let unpairRequest = await showConfirmationMessage(
				`Hello, ${origin}!`,
				'Unpair mobile app?',
				'Unpair mobile app?',
			);
			if (!unpairRequest) {
				throw new SnapError(
					'User Rejected Request for Unpairing',
					SnapErrorCode.RejectedRequest,
				);
			}
			await sdk.unpair();
			return;

		case 'tss_getAccounts':
			await checkIfPaired();
			const accounts = await sdk.getAccountsInfo();
			return {
				accounts: accounts,
			};

		case 'tss_initPairing':
			let storageExist = await isStorageExist();
			if (storageExist) {
				throw new SnapError(
					'Already paired',
					SnapErrorCode.AlreadyPaired,
				);
			}
			let initPairingRequest = await showConfirmationMessage(
				`Hello, ${origin}!`,
				'Pairing with a new mobile application?',
				'Create a new pair between Metamask Plugin and SilentShard mobile application',
			);

			if (!initPairingRequest) {
				throw new SnapError(
					'User Rejected Request for Pairing',
					SnapErrorCode.RejectedRequest,
				);
			}
			const qrCodeMessage = await sdk.initPairing();
			return {
				qr_code: qrCodeMessage,
			};

		case 'tss_runPairing':
			return await sdk.runPairing();

		case 'tss_runRefresh':
			return await sdk.refreshPairing();

		// case 'tss_backup':
		// 	return await sdk.runBackup();

		case 'tss_runDKG': {
			await checkIfPaired();
			let dkgRequest = await showConfirmationMessage(
				`Hello, ${origin}!`,
				'Create a new Distributed Key?',
				'Create a new Distributed Key between Metamask Plugin and SilentShard mobile application',
			);

			if (!dkgRequest) {
				throw new SnapError(
					'User Rejected Request for Keygen',
					SnapErrorCode.RejectedRequest,
				);
			}
			let dkgResponse = await sdk.runKeygen();
			await sdk.runBackup();
			return { dkgResponse };
		}

		case 'tss_runPairingAndDKG': {
			let pairingResponse = await sdk.runPairing();
			await checkIfPaired();
			if (pairingResponse.used_backup_data) {
				const accounts = await sdk.getAccountsInfo();
				if (accounts.length > 0) {
					return {
						pairingResponse,
						dkgResponse: {
							public_key: accounts[0],
						},
					};
				} else {
					return { pairingResponse };
				}
			} else {
				let dkgResponse = await sdk.runKeygen();
				await sdk.runBackup();
				return { pairingResponse, dkgResponse };
			}
		}

		case 'tss_sendSignRequest':
			const {
				public_key,
				hash_alg,
				message,
				message_hash,
				sign_metadata,
			} = request.params as unknown as {
				public_key: string;
				hash_alg: string;
				message: string;
				message_hash: string;
				sign_metadata: 'eth_transaction' | 'eth_sign';
			};

			let signRequest: string | boolean;
			await checkIfPaired();
			if (sign_metadata === 'eth_transaction') {
				let txn = parseTransaction(message);

				const txnContent = stringContextForTxn(txn);

				signRequest = await showTxnConfirmationMessage(
					'Confirm Transaction',
					'Please confirm the transaction details below:',
					txnContent,
				)!;
			} else {
				// TODO: Show address instead of public key
				signRequest = await showConfirmationMessage(
					`Hello, ${origin}!`,
					'Sign a message?',
					'Public key:\n' +
						public_key +
						'\n\nHash alg:\n' +
						hash_alg +
						'\n\nMessage:\n' +
						Buffer.from(message, 'hex').toString('utf8'),
				);
			}

			if (!signRequest) {
				throw new SnapError(
					'User Rejected Request for Sign',
					SnapErrorCode.RejectedRequest,
				);
			}
			return await sdk.runSign(
				public_key,
				hash_alg,
				message,
				message_hash,
				sign_metadata,
			);

		// For testing purposes
		// Do not uncomment this in production
		// case 'tss_entropy':
		// 	const entropy = await snap.request({
		// 		method: 'snap_getEntropy',
		// 		params: {
		// 			version: 1,
		// 			salt: `salt`,
		// 		},
		// 	});

		// 	return entropy;

		default:
			throw new SnapError('Unknown method', SnapErrorCode.UnknownMethod);
	}
};

function parseTransaction(rlpString: string) {
	const rlpNoPrefix = rlpString.startsWith('0x')
		? rlpString.slice(2)
		: rlpString;
	// For now we only support legacy and 1559 transactions
	let txnType: 0 | 2;

	const prefix = parseInt(rlpNoPrefix.slice(0, 2), 16);
	switch (prefix) {
		case 2: {
			txnType = 2;
			break;
		}

		default: {
			// Legacy transactions first byte is always >= 0xc0
			if (prefix >= 192) {
				txnType = 0;
				break;
			} else if (prefix <= 127) {
				// EIP-2718 transactions first byte is always <= 0x7f
				throw new SnapError(
					'Transaction type not supported yet',
					SnapErrorCode.UnknownTxnType,
				);
			} else {
				// Unknown transaction type
				throw new SnapError(
					'Invalid transaction type',
					SnapErrorCode.UnknownTxnType,
				);
			}
		}
	}

	if (txnType === 0) {
		const bytes = Buffer.from(rlpNoPrefix, 'hex');
		let elems = RLP.decode(bytes) as Uint8Array[];
		elems = elems.map((elem) =>
			elem.length > 0 ? elem : new Uint8Array([0]),
		);
		const nonce = parseInt(toHexString(elems[0]), 16);
		const gasPrice = parseInt(toHexString(elems[1]), 16);
		const gasLimit = parseInt(toHexString(elems[2]), 16);
		const to = toHexString(elems[3]);
		const value = BigInt(toHexString(elems[4]));
		const data = toHexString(elems[5]);
		const v = parseInt(toHexString(elems[6]), 16);
		const txn: LegacyTxn = {
			nonce,
			gasPrice,
			gasLimit,
			to,
			value,
			data,
			v,
			type: 0,
		};

		return txn;
	} else if (txnType === 2) {
		const bytes = Buffer.from(rlpNoPrefix.slice(2), 'hex');
		let elems = RLP.decode(bytes) as Uint8Array[];
		// rlp([chain_id, nonce, max_priority_fee_per_gas, max_fee_per_gas, gas_limit, destination,
		//amount, data, access_list, signature_y_parity, signature_r, signature_s])
		elems = elems.map((elem) =>
			elem.length > 0 ? elem : new Uint8Array([0]),
		);
		const chainId = parseInt(toHexString(elems[0]), 16);
		const nonce = parseInt(toHexString(elems[1]), 16);
		const maxPriorityFeePerGas = parseInt(toHexString(elems[2]), 16);
		const maxFeePerGas = parseInt(toHexString(elems[3]), 16);
		const gasLimit = parseInt(toHexString(elems[4]), 16);
		const to = toHexString(elems[5]);
		const value = BigInt('0x' + toHexString(elems[6]));
		const data = toHexString(elems[7]);

		const txn: Eip1559Txn = {
			chainId,
			nonce,
			maxPriorityFeePerGas,
			maxFeePerGas,
			gasLimit,
			to,
			value,
			data,
			type: 2,
		};

		return txn;
	} else {
		// Unreachable error
		throw new SnapError(
			'Unknown transaction type (should be unreachable)',
			SnapErrorCode.UnknownTxnType,
		);
	}
}

function stringContextForTxn(txn: LegacyTxn | Eip1559Txn) {
	switch (txn.type) {
		case 0: {
			const tx = txn as LegacyTxn;
			const valueEther = formatUnits(tx.value, 18);
			const rawString = `To: 0x${tx.to}, Amount: Ξ${valueEther}, Data: 0x${tx.data}, Gas Price: ${tx.gasPrice} wei, Gas limit: ${tx.gasLimit}`;
			return rawString.split(',');
		}
		case 2: {
			const tx = txn as Eip1559Txn;
			const valueEther = formatUnits(tx.value, 18);
			const rawString = `Destination: 0x${tx.to}, Amount: Ξ${valueEther}, Data: 0x${tx.data}, ChainId: ${tx.chainId}, Max fee per gas: ${tx.maxFeePerGas} wei, Max priority fee per gas: ${tx.maxPriorityFeePerGas} wei, Gas limit: ${tx.gasLimit}`;
			return rawString.split(',');
		}

		default:
			// Unreachable error
			throw new SnapError(
				'Unknown transaction type',
				SnapErrorCode.UnknownTxnType,
			);
	}
}

type LegacyTxn = {
	nonce: number;
	gasPrice: number;
	gasLimit: number;
	to: string;
	value: bigint;
	data: string;
	v: number;
	type: 0;
};

type Eip1559Txn = {
	chainId: number;
	nonce: number;
	maxPriorityFeePerGas: number;
	maxFeePerGas: number;
	gasLimit: number;
	to: string;
	value: bigint;
	data: string;
	type: 2;
};

function formatUnits(value: bigint, decimals: number) {
	let display = value.toString();

	const negative = display.startsWith('-');
	if (negative) display = display.slice(1);

	display = display.padStart(decimals, '0');

	let [integer, fraction] = [
		display.slice(0, display.length - decimals),
		display.slice(display.length - decimals),
	];
	fraction = fraction.replace(/(0+)$/, '');
	return `${negative ? '-' : ''}${integer || '0'}${
		fraction ? `.${fraction}` : ''
	}`;
}
