import { defineConfig } from 'tsdown';

export default defineConfig({
	globalName: 'LocalityIDB',
	format: ['esm', 'cjs', 'iife'],
	dts: true,
	exports: true,
	unbundle: false,
	deps: {
		onlyBundle: false,
	},
	treeshake: true,
	checks: {
		pluginTimings: false,
	},
});
