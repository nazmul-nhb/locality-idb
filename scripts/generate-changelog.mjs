#!/usr/bin/env node

// @ts-check

/**
 * @fileoverview Generates CHANGELOG.md using GitHub Releases.
 *
 * This script fetches release data from the GitHub API and formats it
 * into a professional markdown changelog, similar to the main CHANGELOG.md.
 *
 * Usage:
 *   node scripts/generate-changelog.mjs
 *   pnpm changelog
 *
 * Environment:
 *   GITHUB_TOKEN — Required to fetch releases from GitHub API.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimator } from 'nhb-scripts';
import { getReleases, githubRepo } from './github.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CHANGELOG_PATH = resolve(ROOT, 'CHANGELOG.md');

const REPO_URL = `https://github.com/${githubRepo.owner}/${githubRepo.repo}`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	const releases = await getReleases();

	if (!releases || releases.length === 0) {
		console.error('✗ No releases found.');
		process.exit(1);
	}

	/** @type {string[]} */
	const sections = [];

	for (let i = 0; i < releases.length; i++) {
		const release = releases[i];
		const previousRelease = releases[i + 1];
		const date = release.date ? release.date.slice(0, 10) : 'unknown';

		/** @type {string[]} */
		const sectionParts = [];

		// Section header with link to release
		sectionParts.push(`## [${release.version}](${release.url}) — ${date}`);
		sectionParts.push('');

		// Compare link (only if there's a previous release)
		if (previousRelease) {
			sectionParts.push(
				`[Compare changes](${REPO_URL}/compare/${previousRelease.version}...${release.version})`
			);
			sectionParts.push('');
		}

		// Release body (already cleaned up by getReleases)
		if (release.body) {
			sectionParts.push(release.body.replace(/^#{1,6}\s*.+(?:\r?\n|$)/gm, ''));
		} else {
			sectionParts.push('_No notable changes._');
		}

		sections.push(sectionParts.join('\n'));
	}

	// ── Assemble the final CHANGELOG.md ───────────────────────────────────

	const changelog = [
		'# Changelog',
		'',
		'All notable changes to **locality-idb** will be documented here.',
		'',
		`> Auto-generated from [GitHub Releases](${REPO_URL}/releases).`,
		'',
		...sections.map((s) => `${s}\n`),
	].join('\n');

	writeFileSync(CHANGELOG_PATH, changelog, 'utf-8');
}

try {
	await estimator(main(), 'Generating CHANGELOG.md from GitHub Releases');
} catch (error) {
	const message = error instanceof Error ? error.message : 'Failed to update the changelog!';
	console.error(message);
	process.exit(0);
}
