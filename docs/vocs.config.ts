import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';
import type { Uncertain } from 'toolbox-x/types';
import { Changelog, defineConfig } from 'vocs/config';
import { version } from '../package.json';

const githubRepo = {
	owner: 'nazmul-nhb',
	repo: 'locality-idb',
};

dotenv.config({ quiet: true });

const octokit = new Octokit({
	auth: process.env.GITHUB_TOKEN,
});

const { data: repo } = await octokit.repos.get(githubRepo);

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
			const { data: releases } = await octokit.repos.listReleases(githubRepo);

			return releases.map((release) => ({
				version: release.tag_name,
				title: release.name ?? release.tag_name,
				date: release.published_at || '',
				body: cleanupReleaseBody(release.body, release.tag_name),
				url: release.html_url,
			}));
		},
	}),
	description: 'SQL-like query builder for IndexedDB with a chainable API',
	topNav: [
		{ text: 'Guide', link: '/intro/getting-started' },
		{ text: 'API Reference', link: '/reference/locality' },
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
					text: `GitHub: ${repo.stargazers_count} ★`,
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
				{ text: 'Getting Started', link: '/intro/getting-started' },
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

/**
 * Cleans a GitHub release body for rendering in the documentation site.
 */
function cleanupReleaseBody(body: Uncertain<string>, tagName: string): string {
	if (!body) return '';

	return (
		body
			// Replace the package title (## 📦 locality-idb v2.5.0, # 📦..., etc.) with tag (v2.5.0)
			.replace(/^#{1,6}\s*.*locality-idb\s+v[^\n]*\n+/gim, `## ${tagName}`)

			// Remove the "Release Notes" heading.
			.replace(/^#{1,6}\s*.*Release Notes\s*\n+/gim, '')

			// Remove commit hashes.
			.replace(/\[[a-f0-9]{7,40}\]\s*-\s*/gi, '')

			// Remove author names at the end of list items.
			.replace(/\s+\([^()]+\)$/gm, '')

			// Remove the Compare Changes section.
			.replace(/\n+\*\*Compare Changes:\*\*[\s\S]*?(?=\n---|\s*$)/i, '')

			// Remove footer.
			.replace(/\n*---\s*\n+\*\*\[Docs\][\s\S]*?\[NPM\][\s\S]*?\*\*\s*$/i, '')

			// Fix spelling issues
			.replace(/\sspcific\s/g, ' specific ')
			.replace(/\scompatilbility\s/g, ' compatibility ')
			.replace(/\ssplitted\s/g, ' split ')
			.replace(/transction/g, 'transaction')
			.replace(
				'luteral genericl uodated docs',
				'literal generic type for default value; updated docs'
			)

			// Normalize whitespace.
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	);
}
