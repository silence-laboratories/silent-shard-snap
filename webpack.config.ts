import { resolve } from 'path';
import SnapsWebpackPlugin from '@metamask/snaps-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import WebpackBarPlugin from 'webpackbar';
import { ProvidePlugin } from 'webpack';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const HookShellScriptWebpackPlugin = require('hook-shell-script-webpack-plugin');

// Configuration that is shared between the two bundles
const common: Configuration = {
	// For simplicity, we don't do any optimisations here. Ideally, this would be
	// dependent on the `NODE_ENV` or script you're running.
	mode: 'none',
	devtool: 'source-map',
	resolve: {
		extensions: ['.js', '.jsx', '.ts', '.tsx'],
		fallback: {
			stream: require.resolve('stream-browserify'),
			path: require.resolve('path-browserify'),
		},
	},
	output: {
		path: resolve(__dirname, 'dist'),
		filename: '[name].js',
		publicPath: './dist',
	},
	module: {
		rules: [
			{
				test: /\.(m?js|ts)x?$/u,
				use: [
					{
						loader: 'babel-loader',
						options: {
							cacheDirectory: true,
						},
					},
				],
			},
		],
	},
	plugins: [new WebpackBarPlugin()],
	stats: 'errors-only',
	watchOptions: {
		ignored: ['**/snap.manifest.json'],
	},
};

// Configuration for the Snap bundle
const snapConfig: Configuration = merge(common, {
	entry: {
		snap: './src/index.ts',
	},
	output: {
		// Required so that webpack doesn't mangle our `exports` variable
		libraryTarget: 'commonjs',
	},
	plugins: [
		new SnapsWebpackPlugin(),
		new HookShellScriptWebpackPlugin({
			afterEmit: ['yarn manifest', 'yarn eval'],
		}),
		new ProvidePlugin({
			Buffer: ['buffer', 'Buffer'],
		}),
	],
});

// Configuration for the website bundle
const webConfig: Configuration = merge(common, {
	entry: './index.js',
	plugins: [
		new HtmlWebpackPlugin({
			template: './index.html',
			filename: './index.html',
		}),
	],
});

const config = [snapConfig, webConfig];
export default config;
