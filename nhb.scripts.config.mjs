// @ts-check

import { defineScriptConfig } from 'nhb-scripts';

export default defineScriptConfig({
	commit: {
		runFormatter: false,
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
