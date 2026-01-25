import { defineConfig } from 'tsdown';

export default defineConfig({
	exports: true,
	unbundle: false,
	noExternal: [
		'nhb-toolbox',
		'nhb-toolbox/hashhash',
		'nhb-toolbox/utils/types',
		'nhb-toolbox/hash/types',
		'nhb-toolbox/object/types',
	],
	treeshake: true,
});
