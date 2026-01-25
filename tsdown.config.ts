import { defineConfig } from 'tsdown';

export default defineConfig({
	exports: true,
	unbundle: false,
	noExternal: ['nhb-toolbox', 'nhb-toolbox/hash'],
	treeshake: true,
	inlineOnly: false,
});
