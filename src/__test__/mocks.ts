export const TO_ADDRESS = '0x0c54fccd2e384b4bb6f2e405bf5cbc15a017aafb';

export interface Eip1559Tx {
	[key: string]: string | never[];
	type: string;
	nonce: string;
	to: string;
	from: string;
	value: string;
	data: string;
	gasLimit: string;
	maxPriorityFeePerGas: string;
	maxFeePerGas: string;
	accessList: never[];
	chainId: string;
}
export const genMockEip1559Tx = (address: string) => {
	return {
		type: '0x2',
		nonce: '0x1',
		to: TO_ADDRESS,
		from: address,
		value: '0x0',
		data: '0x',
		gasLimit: '0x5208',
		maxPriorityFeePerGas: '0x3b9aca00',
		maxFeePerGas: '0x2540be400',
		accessList: [],
		chainId: '0xaa36a7',
	};
};

export interface LegacyTx {
	[key: string]: string
	type: string;
	nonce: string;
	to: string;
	from: string;
	value: string;
	data: string;
	gasLimit: string;
	gasPrice: string;
	chainId: string;
}
export const genMockLegacyTx = (address: string) => {
	return {
		type: '0x0',
		nonce: '0x0',
		to: TO_ADDRESS,
		from: address,
		value: '0x0',
		data: '0x',
		gasLimit: '0x5208',
		gasPrice: '0x2540be400',
		chainId: '0xaa36a7',
	};
};

const exampleMessage = 'Example `personal_sign` message';
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
	types: {
		EIP712Domain: [
			{ name: 'name', type: 'string' },
			{ name: 'version', type: 'string' },
			{ name: 'chainId', type: 'uint256' },
			{ name: 'verifyingContract', type: 'address' },
		],
		Person: [
			{ name: 'name', type: 'string' },
			{ name: 'wallet', type: 'address' },
		],
		Mail: [
			{ name: 'from', type: 'Person' },
			{ name: 'to', type: 'Person' },
			{ name: 'contents', type: 'string' },
		],
	},
	primaryType: 'Mail',
	domain: {
		name: 'Ether Mail',
		version: '1',
		chainId: 11155111,
		verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
	},
	message: {
		from: {
			name: 'Cow',
			wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
		},
		to: {
			name: 'Bob',
			wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
		},
		contents: 'Hello, Bob!',
	},
};

export const mockSignTypedDataV1 = [
	{
		type: 'string',
		name: 'Message',
		value: 'Hi, Alice!',
	},
	{
		type: 'uint32',
		name: 'A number',
		value: '1337',
	},
];
