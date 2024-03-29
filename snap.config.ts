// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

import type { SnapConfig } from '@metamask/snaps-cli';

const config: SnapConfig = {
	bundler: 'webpack',
	input: 'src/index.ts',
	server: { port: 8080 },
	polyfills: {
		buffer: true,
		stream: true,
		crypto: true,
		path: true,
	},
	environment: {
		DAPP_ORIGIN_PRODUCTION: 'https://snap.silencelaboratories.com',
		DAPP_ORIGIN_DEVELOPMENT: 'http://localhost:3000/',
	},
	stats: {
		builtIns: {
			// The following builtins can be ignored. They are used by some of the
			// dependencies, but are not required by this snap.
			ignore: [
				'events',
				'http',
				'https',
				'zlib',
				'util',
				'url',
				'string_decoder',
				'punycode',
			],
		},
	},
};

export default config;
