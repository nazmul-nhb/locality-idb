import { defineConfig } from 'tsdown';

export default defineConfig({
	globalName: 'LocalityIDB',
	format: ['cjs', 'esm', 'umd', 'iife'],
	dts: true,
	exports: true,
	unbundle: false,
	noExternal: ['nhb-toolbox', 'nhb-toolbox/hash'],
	treeshake: true,
	inlineOnly: false,
});
