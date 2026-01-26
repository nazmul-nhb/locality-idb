import { defineScriptConfig } from 'nhb-scripts';

export default defineScriptConfig({
	format: {
		args: ['--write'],
		files: [
			'src',
			'eslint.config.mjs',
			'nhb.scripts.config.mjs',
			'demo/src',
			'demo/eslint.config.mjs',
		],
		ignorePath: '.prettierignore',
	},
	lint: { folders: ['src', 'demo'] },
	commit: {
		runFormatter: true,
		emojiBeforePrefix: true,
		wrapPrefixWith: '`',
		commitTypes: {
			custom: [{ emoji: '🚀', type: 'init' }],
		},
	},
	count: {
		defaultPath: '.',
		excludePaths: ['node_modules', 'dist'],
	},
});
