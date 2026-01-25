import { defineScriptConfig } from 'nhb-scripts';

export default defineScriptConfig({
	format: {
		args: ['--write'],
		files: ['src', 'tests'],
		ignorePath: '.prettierignore',
	},
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
