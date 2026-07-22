#!/usr/bin/env node

// @ts-check

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Stylog } from 'toolbox-x/stylog';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(DOCS_ROOT, '..');

const FUTURE_PATH = resolve(REPO_ROOT, 'FUTURE.md');
const MDX_PATH = resolve(DOCS_ROOT, 'src/pages/future-plans.mdx');

const future = readFileSync(FUTURE_PATH, 'utf-8');

writeFileSync(MDX_PATH, future, 'utf-8');

console.info(Stylog.cyan.toANSI(`✓ Successfully updated future.mdx from FUTURE.md`));
