module.exports = {
	extends: ['../../.eslintrc.js'],

	overrides: [
		{
			files: ['*.ts'],
			extends: ['@metamask/eslint-config-typescript'],
			rules: {
				'import/no-nodejs-modules': [
					'error',
					{ allow: ['buffer', 'crypto'] },
				],
			},
		},
	],

	ignorePatterns: [
		'!.prettierrc.js',
		'**/!.eslintrc.js',
		'**/dist*/',
		'**/*__GENERATED__*',
		'**/build',
		'**/public',
		'**/.cache',
	  ],
};
