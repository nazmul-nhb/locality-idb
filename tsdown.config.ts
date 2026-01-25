import { defineConfig } from 'tsdown';

export default defineConfig({
	exports: true,
	unbundle: false,
	external: [],
	treeshake: true,
});
