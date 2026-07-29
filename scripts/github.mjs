// @ts-check

import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';

/**
 * @import { Uncertain } from 'toolbox-x/types';
 */

export const githubRepo = {
	owner: 'nazmul-nhb',
	repo: 'locality-idb',
};

dotenv.config({ quiet: true });

const octokit = new Octokit({
	auth: process.env.GITHUB_TOKEN,
});

/**
 * Cleans a GitHub release body for rendering in the changelog.
 * @param {Uncertain<string>} body
 * @param {string} tagName
 * @returns string Cleaned up release body
 */
export function cleanupReleaseBody(body, tagName) {
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
			.replace(/\ssplitted\s/g, ' split ')
			.replace('spcific', 'specific')
			.replace('compatilbility', 'compatibility')
			.replace('transction', 'transaction')
			.replace('toops', 'loops')
			.replace(
				'luteral genericl uodated docs',
				'literal generic type for default value; updated docs'
			)

			// Normalize whitespace.
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	);
}

export async function getReleases() {
	const releases = await octokit.paginate(octokit.rest.repos.listReleases, {
		...githubRepo,
	});

	return releases.slice(0, -2).map((release) => ({
		version: release.tag_name,
		title: release.name ?? release.tag_name,
		date: release.published_at || '',
		body: cleanupReleaseBody(release.body, release.tag_name),
		url: release.html_url,
	}));
}

export async function getStars() {
	const { data } = await octokit.repos.get(githubRepo);

	return data.stargazers_count;
}
