import { Changelog, defineConfig } from 'vocs/config';

export default defineConfig({
	title: 'Locality IDB',
	iconUrl: '/favicon.png',
	logoUrl: '/locality-idb.png',
	banner: {
		content: '⭐ Check out the new release!',
		variant: 'success',
		href: '/changelog',
	},
	changelog: Changelog.github({
		repo: 'nazmul-nhb/locality-idb',
		prereleases: true,
	}),
	description: 'SQL-like query builder for IndexedDB with a chainable API',
	topNav: [
		{ text: 'Guide', link: '/intro/motivation' },
		{ text: 'API Reference', link: '/reference/locality' },
		{ text: 'Changelog', link: '/changelog' },
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
		// {
		//   icon: 'npm',
		//   link: 'https://www.npmjs.com/package/locality-idb',
		// },
	],
	sidebar: [
		{
			text: 'Introduction',
			collapsed: false,
			items: [
				{ text: 'Getting Started', link: '/' },
				{ text: 'Features', link: '/intro/features' },
				{ text: 'Why Locality IDB?', link: '/intro/motivation' },
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
			text: 'Usage Guide',
			collapsed: false,
			items: [
				{ text: 'Initialization', link: '/guide/init' },
				{ text: 'Insert Records', link: '/guide/insert' },
				{ text: 'Query Records', link: '/guide/query' },
				{ text: 'Update Records', link: '/guide/update' },
				{ text: 'Delete Records', link: '/guide/delete' },
				{ text: 'Transactions', link: '/guide/transactions' },
				{ text: 'Export & Import', link: '/guide/import-export' },
				{ text: 'Cursor Pagination & Streaming', link: '/guide/pagination-streaming' },
				{ text: 'Database Maintenance', link: '/guide/maintenance' },
			],
		},
		{
			text: 'API Reference',
			collapsed: false,
			items: [
				{ text: 'Locality Class', link: '/reference/locality' },
				{ text: 'Schema Functions', link: '/reference/schema-fns' },
				{ text: 'Column Modifiers', link: '/reference/modifiers' },
				{ text: 'Query Builders', link: '/reference/queries' },
				{ text: 'Utilities', link: '/reference/utilities' },
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
