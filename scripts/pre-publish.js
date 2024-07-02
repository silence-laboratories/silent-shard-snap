// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

const chalk = require('chalk');
const fs = require('fs');

// Read the package.json file
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const snapManifestJson = JSON.parse(fs.readFileSync('snap.manifest.json', 'utf8'));

const execEnv = process.env.NODE_ENV;
const currentVersion = packageJson.version;
let baseRepoUrl = '';
let name = '';
let rpcOrigins = [];
let keyringOrigins = [];
let initialConnectionOrigins = [];

// Check the environment
if (execEnv === 'staging') {
	console.log(`${chalk.green.bold('PREPUBLISH STAGING ANNOUNCEMENT')}\u{1F447}\u{1F447}\u{1F447}`);
	baseRepoUrl =
		'https://www.npmjs.com/package/@silencelaboratories/silent-shard-snap-staging';
	name = '@silencelaboratories/silent-shard-snap-staging';
    rpcOrigins = ["https://snap-staging.silencelaboratories.com", "http://localhost:3000"];
} else if (execEnv === 'production') {
	console.log(`${chalk.green.bold('PREPUBLISH PRODUCTION ANNOUNCEMENT')}\u{1F447}\u{1F447}\u{1F447}`);
	baseRepoUrl =
		'https://www.npmjs.com/package/@silencelaboratories/silent-shard-snap';
	name = '@silencelaboratories/silent-shard-snap';
    rpcOrigins = ["https://snap.silencelaboratories.com"];
} else {
	console.log(chalk.red(`Invalid environment: ${execEnv}`));
	throw new Error('Invalid environment');
}

keyringOrigins = rpcOrigins;
initialConnectionOrigins = rpcOrigins;

const announcement = chalk.italic(
	`We will publish new version of ${chalk.yellow(
		name,
	)} ${chalk.cyan.bold(
		currentVersion,
	)} to NPM. Please make sure you have the correct ${chalk.cyan.bold(
		'NEW VERSION',
	)} in the ${chalk.yellow('package.json')}.`,
);
console.log(announcement);

// Override package.json fields
packageJson.name = name;
packageJson.repository.url = baseRepoUrl;
packageJson.homepage = baseRepoUrl;

// Override snap.manifest.json fields
snapManifestJson.initialPermissions['endowment:rpc'].allowedOrigins = rpcOrigins;
snapManifestJson.initialPermissions['endowment:keyring'].allowedOrigins = keyringOrigins;
snapManifestJson.initialConnections = initialConnectionOrigins.reduce((acc, key) => {
  acc[key] = {};
  return acc;
}, {});;



// Write the package.json file
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2), 'utf8');

// Write the snap.manifest.json file
fs.writeFileSync('snap.manifest.json', JSON.stringify(snapManifestJson, null, 2), 'utf8');