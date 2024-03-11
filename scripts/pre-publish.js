// Copyright (c) Silence Laboratories Pte. Ltd.
// This software is licensed under the Silence Laboratories License Agreement.

const chalk = require('chalk');
const fs = require('fs');

// Read the package.json file
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const execEnv = process.env.NODE_ENV;
let baseRepoUrl = '';
let name = '';
const currentVersion = packageJson.version;

// Check the environment
if (execEnv === 'staging') {
	console.log(`${chalk.green.bold('PREPUBLISH STAGING ANNOUNCEMENT')}`);
	baseRepoUrl =
		'https://www.npmjs.com/package/@silencelaboratories/silent-shard-snap-staging';
	name = '@silencelaboratories/silent-shard-snap-staging';
} else if (execEnv === 'production') {
	console.log(`${chalk.green.bold('PREPUBLISH PRODUCTION ANNOUNCEMENT')}`);
	baseRepoUrl =
		'https://www.npmjs.com/package/@silencelaboratories/silent-shard-snap';
	name = '@silencelaboratories/silent-shard-snap';
} else {
	console.log(chalk.red(`Invalid environment: ${execEnv}`));
	throw new Error('Invalid environment');
}
const announcement = chalk.black.italic(
	`We will publish new version of ${chalk.yellow(
		name,
	)} ${chalk.cyan.bold(
		currentVersion,
	)} to NPM. Please make sure you have the correct ${chalk.cyan.bold(
		'NEW VERSION',
	)} in the ${chalk.yellow('package.json')}.`,
);
console.log(announcement);
// Override the fields
packageJson.name = name;
packageJson.repository.url = baseRepoUrl;
packageJson.homepage = baseRepoUrl;

// Write the package.json file
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2), 'utf8');
