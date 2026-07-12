#!/usr/bin/env node

// @ts-check

/**
 * @fileoverview Generates a professional CHANGELOG.md from all git version tags.
 *
 * Uses `changelog-maker` to produce markdown-formatted commit logs between
 * consecutive tags. The output is deterministic — running this script with
 * the same set of tags always produces the same CHANGELOG.md.
 *
 * Usage:
 *   node scripts/generate-changelog.mjs
 *   pnpm changelog
 *
 * Environment:
 *   GITHUB_TOKEN — Optional. Enables PR metadata resolution via GitHub API.
 *                  Auto-available in GitHub Actions; set manually for local use.
 */

import { exec } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { estimator } from 'nhb-scripts';

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CHANGELOG_PATH = resolve(ROOT, 'CHANGELOG.md');

const REPO_OWNER = 'nazmul-nhb';
const REPO_NAME = 'locality-idb';
const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Run a shell command and return trimmed stdout.
 * @param {string} cmd
 * @returns {Promise<string>}
 */
async function runShell(cmd) {
	try {
		const { stdout } = await execAsync(cmd, {
			cwd: ROOT,
			maxBuffer: 10 * 1024 * 1024,
		});
		return stdout.trim();
	} catch {
		return '';
	}
}

/**
 * Get the ISO date string (YYYY-MM-DD) for a given git ref.
 * @param {string} ref
 * @returns {Promise<string>}
 */
async function getTagDate(ref) {
	// For annotated tags, use taggerdate; for lightweight, use committerdate.
	const date =
		(await runShell(`git log -1 --format=%ai "${ref}"`)) ||
		(await runShell(`git log -1 --format=%ci "${ref}"`));
	return date ? date.slice(0, 10) : 'unknown';
}

/**
 * Generate changelog entries between two refs using changelog-maker.
 * @param {string} startRef
 * @param {string} endRef
 * @returns {Promise<string>}
 */
async function generateNotes(startRef, endRef) {
	// Get the first commit AFTER startRef (mirroring the publish workflow logic)
	const firstAfter = await runShell(
		`git rev-list --reverse "${startRef}..${endRef}" | head -n 1`
	);

	if (!firstAfter) return '';

	const notes = await runShell(
		`npx changelog-maker --markdown --group --filter-release --start-ref "${firstAfter}" --end-ref "${endRef}" ${REPO_OWNER} ${REPO_NAME}`
	);

	return notes;
}

/**
 * Generate changelog entries for the very first tag (from repo beginning).
 * @param {string} endRef
 * @returns {Promise<string>}
 */
async function generateNotesFromBeginning(endRef) {
	const notes = await runShell(
		`npx changelog-maker --markdown --group --filter-release --end-ref "${endRef}" --all ${REPO_OWNER} ${REPO_NAME}`
	);

	return notes;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	// Ensure we have all tags
	await runShell('git fetch --tags --prune 2>/dev/null || true');

	// Get all version tags sorted newest → oldest
	const tagsRaw = await runShell("git tag -l 'v*' --sort=-v:refname");

	if (!tagsRaw) {
		console.error('✗ No version tags found.');
		process.exit(1);
	}

	const tags = tagsRaw.split('\n').filter(Boolean);

	// Check for unreleased commits (commits after the latest tag)
	// const latestTag = tags[0];
	// const unreleasedCommits = await runShell(
	// 	`git rev-list --count "${latestTag}..HEAD" 2>/dev/null`
	// );
	// const hasUnreleased = Number.parseInt(unreleasedCommits, 10) > 0;

	/** @type {string[]} */
	const sections = [];

	// ── Unreleased section ──────────────────────────────────────────────────
	// if (hasUnreleased) {
	// const firstAfter = await runShell(
	// 	`git rev-list --reverse "${latestTag}..HEAD" | head -n 1`
	// );
	// if (firstAfter) {
	// 	const notes = await runShell(
	// 		`npx changelog-maker --markdown --group --filter-release --start-ref "${firstAfter}" ${REPO_OWNER} ${REPO_NAME}`
	// 	);
	// 	if (notes) {
	// 		sections.push(
	// 			[
	// 				`## [Unreleased](${REPO_URL}/compare/${latestTag}...HEAD)`,
	// 				'',
	// 				notes,
	// 			].join('\n')
	// 		);
	// 	}
	// }
	// }

	// ── Release sections (newest → oldest) ──────────────────────────────────
	for (let i = 0; i < tags.length; i++) {
		const currentTag = tags[i];
		const previousTag = tags[i + 1]; // older tag (or undefined for the first ever)
		const date = await getTagDate(currentTag);

		let notes;
		if (previousTag) {
			notes = await generateNotes(previousTag, currentTag);
		} else {
			// First ever tag — generate from the beginning of the repo
			notes = await generateNotesFromBeginning(currentTag);
		}

		/** @type {string[]} */
		const sectionParts = [];

		// Section header with link to release
		sectionParts.push(
			`## [${currentTag}](${REPO_URL}/releases/tag/${currentTag}) — ${date}`
		);
		sectionParts.push('');

		// Compare link (only if there's a previous tag)
		if (previousTag) {
			sectionParts.push(
				`[Compare changes](${REPO_URL}/compare/${previousTag}...${currentTag})`
			);
			sectionParts.push('');
		}

		// Commit entries
		if (notes) {
			sectionParts.push(notes);
		} else {
			sectionParts.push('_No notable changes._');
		}

		sections.push(sectionParts.join('\n'));
	}

	// ── Assemble the final CHANGELOG.md ─────────────────────────────────────

	const changelog = [
		'# Changelog',
		'',
		'All notable changes to **locality-idb** will be documented in this file.',
		'',
		`> Auto-generated from git history using [changelog-maker](https://github.com/nodejs/changelog-maker).`,
		'',
		...sections.map(
			(s) =>
				`${s
					.replace(/\sspcific\s/g, ' specific ')
					.replace(/\scompatilbility\s/g, ' compatibility ')
					.replace(/\ssplitted\s/g, ' split ')
					.replace(/transction/g, 'transaction')}\n`
		),
	].join('\n');

	writeFileSync(CHANGELOG_PATH, changelog, 'utf-8');
}

try {
	await estimator(main(), 'Updating CHANGELOG.md');
} catch (error) {
	const message = error instanceof Error ? error.message : 'Failed to update the changelog!';
	console.error(message);
	process.exit(0);
}
