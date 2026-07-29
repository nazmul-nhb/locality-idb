import { Changelog, defineConfig } from 'vocs/config';
import { version } from '../package.json';
import { getReleases, getStars } from '../scripts/github.mjs';

const stars = await getStars();

export default defineConfig({
	title: 'Locality IDB',
	iconUrl: '/favicon.png',
	logoUrl: '/locality-idb.png',
	banner: {
		content: '⭐ Check out the new release!',
		variant: 'success',
		href: '/changelog',
	},
	changelog: Changelog.from({
		type: 'github',

		async fetch() {
			return await getReleases();
		},
	}),
	description: 'SQL-like query builder for IndexedDB with a chainable API',
	topNav: [
		{ text: 'Overview', link: '/intro' },
		{ text: 'Examples', link: '/guide' },
		{ text: 'API Reference', link: '/reference' },
		{
			text: `v${version}`,
			items: [
				{ text: 'Changelog', link: '/changelog' },
				{
					external: true,
					text: 'NPM Registry',
					link: 'https://www.npmjs.com/package/locality-idb',
				},
				{
					external: true,
					text: `GitHub: ${stars} ★`,
					link: 'https://github.com/nazmul-nhb/locality-idb',
				},
			],
		},
	],
	groupIcons: {
		customIcons: {
			locality: '/favicon.png',
		},
	},
	socials: [
		{
			icon: 'github',
			link: 'https://github.com/nazmul-nhb/locality-idb',
		},
	],
	sidebar: [
		{
			text: 'Introduction',
			collapsed: false,
			items: [
				{ text: 'Getting Started', link: '/intro' },
				{ text: 'Key Features', link: '/intro/features' },
				{
					text: 'Why Locality IDB?',
					badge: { variant: 'info', text: 'COMPARISON' },
					link: '/intro/motivation',
				},
			],
		},
		{
			text: 'Core Concepts',
			collapsed: false,
			items: [
				{ text: 'Schema Definition', link: '/concepts/schema' },
				{ text: 'Column Types', link: '/concepts/columns' },
				{ text: 'Type Inference', link: '/concepts/inference' },
			],
		},
		{
			text: 'Usage Guide & Examples',
			collapsed: false,
			items: [
				{ text: 'Initialization', link: '/guide' },
				{ text: 'Insert Records', link: '/guide/insert' },
				{ text: 'Query Records', link: '/guide/query' },
				{ text: 'Update Records', link: '/guide/update' },
				{ text: 'Delete Records', link: '/guide/delete' },
				{ text: 'Transactions', link: '/guide/transactions' },
				{ text: 'Export & Import', link: '/guide/import-export' },
				{ text: 'Pagination & Streaming', link: '/guide/pagination-streaming' },
				{ text: 'Database Maintenance', link: '/guide/maintenance' },
			],
		},
		{
			text: 'API Reference',
			collapsed: false,
			items: [
				{ text: 'Locality Class', link: '/reference' },
				{ text: 'Schema Functions', link: '/reference/schema-fns' },
				{ text: 'Column Modifiers', link: '/reference/modifiers' },
				{ text: 'Query Builders', link: '/reference/queries' },
				{ text: 'Utility Functions', link: '/reference/utilities' },
				{ text: 'Validation Rules', link: '/reference/validation' },
			],
		},
		{
			text: 'TypeScript',
			collapsed: false,
			items: [{ text: 'Type System Reference', link: '/typescript/types' }],
		},
		{
			text: 'Future Plans',
			collapsed: false,
			items: [{ text: 'Future Considerations', link: '/future-plans' }],
		},
		{
			text: 'FAQ & Resources',
			collapsed: false,
			items: [{ text: 'FAQ & Common Pitfalls', link: '/faq' }],
		},
	],
});
