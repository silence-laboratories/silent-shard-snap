import { IP1KeyShare } from '@silencelaboratories/ecdsa-tss';
import { SignMetadata } from '../types';
import { fromHexStringToBytes } from '../snap/utils';
import { SnapError, SnapErrorCode } from '../error';
import * as SignAction from '../snap/actions/sign';

export const WALLER_ADDRESS = '0x660265edc169bab511a40c0e049cc1e33774443d';
export const TO_ADDRESS = '0x0c54fccd2e384b4bb6f2e405bf5cbc15a017aafb';

export const MOCK_WALLET_ACCOUNT: any = {
	account: {
		id: 'f4211653-1b5f-4497-b5e6-f7b56824ba21',
		options: {},
		address: WALLER_ADDRESS,
		methods: [
			'eth_sign',
			'eth_signTransaction',
			'eth_signTypedData_v1',
			'eth_signTypedData_v3',
			'eth_signTypedData_v4',
			'personal_sign',
		],
		type: 'eip155:eoa',
	},
};

export const genMockRunTssSign =
	(pairingData: any) =>
	async (
		hashAlg: string,
		message: string,
		messageHashHex: string,
		signMetadata: SignMetadata,
		accountId: number,
		keyShare: IP1KeyShare,
	) => {
		if (messageHashHex.startsWith('0x')) {
			messageHashHex = messageHashHex.slice(2);
		}
		if (message.startsWith('0x')) {
			message = message.slice(2);
		}

		// TODO: Do we want to simulate token expiration?
		// let silentShareStorage = await getSilentShareStorage();
		// let pairingData = silentShareStorage.pairingData;
		// if (pairingData.tokenExpiration < Date.now() - TOKEN_LIFE_TIME) {
		// 	pairingData = await refreshPairing();
		// }
		const messageHash = fromHexStringToBytes(messageHashHex);
		if (messageHash.length !== 32) {
			throw new SnapError(
				'Invalid length of messageHash, should be 32 bytes',
				SnapErrorCode.InvalidMessageHashLength,
			);
		}

		return await SignAction.sign(
			pairingData,
			keyShare,
			hashAlg,
			message,
			messageHash,
			signMetadata,
			accountId,
		);
	};

export const mockEip1559Tx: any = {
	type: '0x2',
	nonce: '0x1',
	to: TO_ADDRESS,
	from: WALLER_ADDRESS,
	value: '0x0',
	data: '0x',
	gasLimit: '0x5208',
	maxPriorityFeePerGas: '0x3b9aca00',
	maxFeePerGas: '0x2540be400',
	accessList: [],
	chainId: '0xaa36a7',
};

export const mockLegacyTx: any = {
	type: '0x0',
	nonce: '0x0',
	to: TO_ADDRESS,
	from: WALLER_ADDRESS,
	value: '0x0',
	data: '0x',
	gasLimit: '0x5208',
	gasPrice: '0x2540be400',
	chainId: '0xaa36a7',
};

const exampleMessage = 'Example `personal_sign` message.';
export const mockPersonalMsg = `0x${Buffer.from(
	exampleMessage,
	'utf8',
).toString('hex')}`;

export const mockSignTypedDataV4 = {
	domain: {
		chainId: '11155111',
		name: 'Ether Mail',
		verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
		version: '1',
	},
	message: {
		contents: 'Hello, Bob!',
		from: {
			name: 'Cow',
			wallets: [
				'0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
				'0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
			],
		},
		to: [
			{
				name: 'Bob',
				wallets: [
					'0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
					'0xB0BdaBea57B0BDABeA57b0bdABEA57b0BDabEa57',
					'0xB0B0b0b0b0b0B000000000000000000000000000',
				],
			},
		],
		attachment: '0x',
	},
	primaryType: 'Mail',
	types: {
		EIP712Domain: [
			{
				name: 'name',
				type: 'string',
			},
			{
				name: 'version',
				type: 'string',
			},
			{
				name: 'chainId',
				type: 'uint256',
			},
			{
				name: 'verifyingContract',
				type: 'address',
			},
		],
		Group: [
			{
				name: 'name',
				type: 'string',
			},
			{
				name: 'members',
				type: 'Person[]',
			},
		],
		Mail: [
			{
				name: 'from',
				type: 'Person',
			},
			{
				name: 'to',
				type: 'Person[]',
			},
			{
				name: 'contents',
				type: 'string',
			},
			{
				name: 'attachment',
				type: 'bytes',
			},
		],
		Person: [
			{
				name: 'name',
				type: 'string',
			},
			{
				name: 'wallets',
				type: 'address[]',
			},
		],
	},
};

export const mockSignTypedDataV3 = {
    "types": {
        "EIP712Domain": [
            {
                "name": "name",
                "type": "string"
            },
            {
                "name": "version",
                "type": "string"
            },
            {
                "name": "chainId",
                "type": "uint256"
            },
            {
                "name": "verifyingContract",
                "type": "address"
            }
        ],
        "Person": [
            {
                "name": "name",
                "type": "string"
            },
            {
                "name": "wallet",
                "type": "address"
            }
        ],
        "Mail": [
            {
                "name": "from",
                "type": "Person"
            },
            {
                "name": "to",
                "type": "Person"
            },
            {
                "name": "contents",
                "type": "string"
            }
        ]
    },
    "primaryType": "Mail",
    "domain": {
        "name": "Ether Mail",
        "version": "1",
        "chainId": 11155111,
        "verifyingContract": "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
    },
    "message": {
        "from": {
            "name": "Cow",
            "wallet": "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"
        },
        "to": {
            "name": "Bob",
            "wallet": "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"
        },
        "contents": "Hello, Bob!"
    }
}

export const mockSignTypedDataV1 = [
    {
        "type": "string",
        "name": "Message",
        "value": "Hi, Alice!"
    },
    {
        "type": "uint32",
        "name": "A number",
        "value": "1337"
    }
]