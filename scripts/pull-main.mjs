#!/usr/bin/env node

// @ts-check

/**
 * @fileoverview Safe git pull helper before commit to prevent conflicts on release.
 *
 * Runs automatically before `nhb-commit` if the user is on the `main` branch.
 * Uses `--ff-only` to guarantee it only fast-forwards and never creates automatic/unexpected merge commits.
 */

import { execSync } from 'node:child_process';

try {
	// Get current branch name compatibly
	const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();

	// Only run git pull if we are on the main branch
	if (branch === 'main') {
		console.info('↻ main branch detected. Pulling latest changes from remote...');
		execSync('git pull --ff-only');
		console.info('✓ Local main branch is already up-to-date.');
	}
} catch {
	// If git pull fails, it will exit with a non-zero code, preventing the commit flow.
	console.error(
		'\n✗ Failed to sync with remote main branch. Please pull manually or resolve conflicts.'
	);
	process.exit(1);
}
