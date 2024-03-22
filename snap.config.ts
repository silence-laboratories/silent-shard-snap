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
		IS_PRODUCTION: true,
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
	experimental: {
		wasm: true,
	},
};

export default config;
