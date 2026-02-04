import { defineConfig } from 'tsdown';

export default defineConfig({
	globalName: 'LocalityIDB',
	format: ['esm', 'cjs', 'iife'],
	dts: true,
	exports: true,
	unbundle: false,
	noExternal: ['nhb-toolbox', 'nhb-toolbox/hash'],
	treeshake: true,
	inlineOnly: false,
});
