import './style.css';

import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import {
	column,
	defineSchema,
	type Email,
	getTimestamp,
	type ImportMode,
	isEmail,
	isTimestamp,
	isURL,
	isUUID,
	Locality,
	uuidV4,
	validateColumnType,
} from 'locality';
import { type Operation, operations, testFiles } from './codes';

const schema = defineSchema({
	users: {
		id: column.int().pk().auto(),
		name: column.text(),
		email: column.email().unique(),
		score: column.int().default(0).index(),
		createdAt: column.timestamp().index(),
	},
	posts: {
		id: column.int().pk().auto(),
		userId: column
			.int()
			.ref('users.id', { onDelete: 'cascade', onUpdate: 'cascade' })
			.index(),
		title: column.text(),
		likes: column.int().default(0).index(),
		createdAt: column.timestamp().index(),
	},
	comments: {
		id: column.int().pk().auto(),
		postId: column.int().ref('posts.id', { onDelete: 'cascade' }).index(),
		body: column.text(),
		createdAt: column.timestamp(),
	},
	auditLogs: {
		id: column.int().pk().auto(),
		event: column.text(),
		createdAt: column.timestamp(),
	},
});

export const db = new Locality({ dbName: 'locality-api-lab', version: 4, schema });
type TableName = keyof typeof schema;
type Tone = 'success' | 'error' | 'info';

let activeOperation = operations[0].id;
let activeFile = Object.keys(operations[0].files)[0];
let activeTestFile = Object.keys(testFiles)[0];
let editor: EditorView;
let testEditor: EditorView;
let testLog: { tone: Tone; title: string; detail: string }[] = [];
let lastResult: unknown = { message: 'Select an API surface, then run its live example.' };

function requiredElement<T extends Element>(selector: string): T {
	const element = document.querySelector<T>(selector);
	if (!element) throw new Error(`Expected ${selector} to exist.`);
	return element;
}

const app = requiredElement<HTMLDivElement>('#app');
const dialog = requiredElement<HTMLDialogElement>('#confirmDialog');
const dialogTitle = requiredElement<HTMLElement>('#dialogTitle');
const dialogDescription = requiredElement<HTMLElement>('#dialogDescription');

function escapeHtml(value: string) {
	return value.replace(
		/[&<>'"]/g,
		(char) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ??
			char
	);
}
function json(value: unknown) {
	return JSON.stringify(
		value,
		(_key, item) => (typeof item === 'bigint' ? `${item}n` : item),
		2
	);
}
function currentOperation() {
	return operations.find((operation) => operation.id === activeOperation) ?? operations[0];
}
function fileIcon(name: string) {
	return name.endsWith('.test.ts') ? '◉' : '◆';
}
function showToast(tone: Tone, message: string) {
	const toast = document.createElement('div');
	toast.className = `toast ${tone}`;
	toast.textContent = message;
	requiredElement('#toastRegion').append(toast);
	setTimeout(() => toast.remove(), 4600);
}
function updateResult(value: unknown) {
	lastResult = value;
	const output = document.querySelector('#resultOutput');
	if (output) output.textContent = json(value);
}
function renderEditor(host: HTMLElement, source: string, previous?: EditorView) {
	previous?.destroy();
	return new EditorView({
		state: EditorState.create({
			doc: source,
			extensions: [
				javascript({ typescript: true }),
				oneDark,
				EditorState.readOnly.of(true),
				EditorView.editable.of(false),
				EditorView.lineWrapping,
			],
		}),
		parent: host,
	});
}
function choices(
	rows: Array<Record<string, unknown>>,
	label: (row: Record<string, unknown>) => string
) {
	return (
		rows
			.map(
				(row) =>
					/* html*/ `<option value="${row.id}">${escapeHtml(label(row))}</option>`
			)
			.join('') || /* html*/ `<option value="">No rows yet — seed first</option>`
	);
}
async function getRows(table: TableName) {
	return await db.from(table).sortByIndex('id').findAll();
}
async function refreshSelects() {
	const [users, posts, dbs] = await Promise.all([
		getRows('users'),
		getRows('posts'),
		db.dbList,
	]);
	for (const element of document.querySelectorAll<HTMLSelectElement>('[data-users]'))
		element.innerHTML = choices(users, (user) => `#${user.id} · ${user.name}`);
	for (const element of document.querySelectorAll<HTMLSelectElement>('[data-posts]'))
		element.innerHTML = choices(posts, (post) => `#${post.id} · ${post.title}`);
	for (const element of document.querySelectorAll<HTMLSelectElement>('[data-tables]'))
		element.innerHTML = db.tableList
			.map((table) => /* html*/ `<option value="${table}">${table}</option>`)
			.join('');
	for (const element of document.querySelectorAll<HTMLSelectElement>('[data-databases]'))
		element.innerHTML = dbs
			.map(
				(database) =>
					/* html*/ `<option value="${database.name}">${database.name} · v${database.version ?? '?'}</option>`
			)
			.join('');
}
function groupedOperations() {
	return [...new Set(operations.map((operation) => operation.group))]
		.map(
			(group) =>
				/* html*/ `<div class="op-group">${group}</div>${operations
					.filter((operation) => operation.group === group)
					.map(
						(operation, index) =>
							/* html*/ `<button class="operation-button ${operation.id === activeOperation ? 'active' : ''}" data-operation="${operation.id}"><span class="op-tag">${String(index + 1).padStart(2, '0')}</span>${operation.title}</button>`
					)
					.join('')}`
		)
		.join('');
}
function controlsFor(operation: Operation) {
	const run = (label: string, id = 'runOperation', danger = false) =>
		/* html*/ `<button class="button ${danger ? 'button-danger' : 'button-primary'}" data-action="${id}">${label}</button>`;
	const select = (label: string, attr: string, id: string) =>
		/* html*/ `<label class="field">${label}<select id="${id}" ${attr}></select></label>`;
	switch (operation.control) {
		case 'snapshot':
			return /* html*/ `<div class="control-card">${run('Refresh live snapshot')}</div>`;
		case 'details':
			return /* html*/ `<div class="control-card">${run('Inspect connection')}</div>`;
		case 'insert':
			return /* html*/ `<div class="control-card"><label class="field">Target table<select id="insertTable"><option value="users">users</option><option value="posts">posts</option></select></label><label class="field" data-user-field>Name<input id="insertName" value="Linus" /></label><label class="field" data-user-field>Email<input id="insertEmail" value="linus@locality.dev" type="email" /></label><label class="field" data-user-field>Score<input id="insertScore" value="5" type="number" /></label><label class="field" data-post-field hidden>Author<select id="insertUserId" data-users></select></label><label class="field" data-post-field hidden>Title<input id="insertTitle" value="A new post" /></label><label class="field" data-post-field hidden>Likes<input id="insertLikes" value="1" type="number" /></label>${run('Insert row')}</div>`;
		case 'batch':
			return /* html*/ `<div class="control-card">${run('Insert sample batch')}<div class="detail-note">Run this after a clear or with fresh emails. The Tests workspace demonstrates the failing duplicate batch.</div></div>`;
		case 'seed':
			return /* html*/ `<div class="control-card">${run('Seed four tables')}<div class="detail-note">Creates users first, then their posts, comments, and an audit entry. Safe to run only when the lab is empty.</div></div>`;
		case 'read':
			return /* html*/ `<div class="control-card">${run('Run read examples')}</div>`;
		case 'lookup':
			return /* html*/ `<div class="control-card">${select('User record', 'data-users', 'lookupUser')}${run('Run primary key & index lookups')}</div>`;
		case 'sort':
			return /* html*/ `<div class="control-card">${run('Run sort & limit')}</div>`;
		case 'aggregate':
			return /* html*/ `<div class="control-card">${run('Calculate post statistics')}</div>`;
		case 'cursor':
			return /* html*/ `<div class="control-card">${run('Page and stream posts')}</div>`;
		case 'update':
			return /* html*/ `<div class="control-card">${select('User to increment', 'data-users', 'updateUser')}${select('Post to update', 'data-posts', 'updatePost')}<label class="field">New post likes<input id="updateLikes" value="21" type="number" /></label>${run('Run both updates')}</div>`;
		case 'delete':
			return /* html*/ `<div class="control-card"><label class="field">Delete target table<select id="deleteTable"><option value="users">users</option><option value="posts">posts</option></select></label><label class="field" data-delete-users>Selected user<select id="deleteUser" data-users></select></label><label class="field" data-delete-posts hidden>Selected post<select id="deletePost" data-posts></select></label>${run('Delete selected row', 'runOperation', true)}<div class="detail-note">Deleting a user cascades through posts and comments by design.</div></div>`;
		case 'reference':
			return /* html*/ `<div class="control-card">${run('Attempt invalid insert')}<div class="detail-note">Expected result: a readable reference error and no new post.</div></div>`;
		case 'transaction':
			return /* html*/ `<div class="control-card">${run('Commit an example transaction')}<button class="button button-quiet" data-action="rollback">Run rollback example</button></div>`;
		case 'export-object':
			return /* html*/ `<div class="control-card">${run('Create export object')}</div>`;
		case 'export-file':
			return /* html*/ `<div class="control-card">${run('Download JSON backup')}<div class="detail-note">Your browser controls the download location.</div></div>`;
		case 'import':
			return /* html*/ `<div class="control-card"><label class="field">Import mode<select id="importMode"><option value="replace">replace</option><option value="upsert">upsert</option></select></label>${run('Round-trip current snapshot')}</div>`;
		case 'maintenance':
			return /* html*/ `<div class="control-card">${select('Table to clear', 'data-tables', 'maintenanceTable')}<button class="button button-danger" data-action="clear-table">Clear selected table</button><button class="button button-quiet" data-action="clear-all">Clear all tables</button></div>`;
		case 'lifecycle':
			return /* html*/ `<div class="control-card">${select('Database', 'data-databases', 'lifecycleDb')}<button class="button button-danger" data-action="delete-db">Delete selected database</button><button class="button button-quiet" disabled>dropTable() — documented above</button><button class="button button-quiet" disabled>close() — documented above</button></div>`;
		default:
			return '';
	}
}
function renderApp() {
	const op = currentOperation();
	const fileNames = Object.keys(op.files);
	if (!op.files[activeFile]) activeFile = fileNames[0];
	app.innerHTML = /* html*/ `<main class="shell"><header class="topbar"><div class="brand"><div class="brand-mark"><img src="./locality-icon.png" /></div><div><h1>Locality IDB / API Lab</h1><p>Executable reference for the browser-native database toolkit</p></div></div><div class="status"><span class="dot"></span><span id="connectionState">Opening IndexedDB…</span></div></header><section class="hero"><div><p class="eyebrow">Interactive documentation</p><h2>See the exact Locality code, then run it against a real database.</h2><p class="hero-copy">Every control is paired with its implementation snippet. The lab uses indexes, schema validation, foreign-key-style refs, transaction contexts, backups, and lifecycle APIs—not a mock data layer.</p></div><div class="hero-stats"><div class="metric"><b id="metricTables">4</b><span>tables</span></div><div class="metric"><b id="metricVersion">v1</b><span>schema version</span></div><div class="metric"><b>2</b><span>workspaces</span></div></div></section><nav class="workspace-nav"><div class="tabs"><button class="main-tab active" data-workspace="interact">Interact From UI</button><button class="main-tab" data-workspace="tests">Tests</button></div><button class="button nav-action" data-action="console-tests">↗ Run transaction-export.ts in console</button></nav><section id="interactPanel" class="panel active"><div class="lab"><aside class="ops-sidebar"><div class="side-title">API surface · ${operations.length} examples</div><div class="operation-list">${groupedOperations()}</div></aside><section class="editor-pane"><div class="file-tabs">${fileNames.map((name) => `<button class="file-tab ${name === activeFile ? 'active' : ''}" data-file="${name}"><span class="ts-dot">${fileIcon(name)}</span>${name}</button>`).join('')}</div><div class="code-meta"><span><strong>${activeFile}</strong> · read only</span><span>CodeMirror</span></div><div class="editor" id="codeEditor"></div></section><aside class="detail-pane"><div class="sticky"><p class="detail-kicker">${op.group}</p><h3>${op.title}</h3><p class="detail-description">${op.description}</p>${controlsFor(op)}${op.note ? `<p class="detail-note">${op.note}</p>` : ''}<div class="result-card"><div class="result-head"><span>LIVE RESULT</span><button class="button button-quiet" data-action="copy-result">Copy</button></div><pre id="resultOutput" class="result-output">${escapeHtml(json(lastResult))}</pre></div></div></aside></div></section><section id="testsPanel" class="panel"><div class="lab test-lab"><section class="editor-pane"><div class="file-tabs">${Object.keys(
		testFiles
	)
		.map(
			(name) =>
				/* html*/ `<button class="file-tab ${name === activeTestFile ? 'active' : ''}" data-test-file="${name}"><span class="ts-dot">${fileIcon(name)}</span>${name}</button>`
		)
		.join(
			''
		)}</div><div class="code-meta"><span><strong>${activeTestFile}</strong> · expected behavior</span><span>Read only</span></div><div class="editor" id="testEditor"></div></section><aside class="test-output"><p class="detail-kicker">Verification</p><h3>Executable API cases</h3><p>Runs isolated checks for atomic batch writes, expected errors, optimized query paths, rollback, and backup restoration.</p><div class="test-actions"><button class="button button-primary" data-action="run-tests">Run all checks</button><button class="button button-quiet" data-action="clear-tests">Clear output</button></div><div id="testLog" class="test-log">${renderTestLog()}</div></aside></div></section></main>`;
	editor = renderEditor(requiredElement('#codeEditor'), op.files[activeFile], editor);
	testEditor = renderEditor(
		requiredElement('#testEditor'),
		testFiles[activeTestFile],
		testEditor
	);
	void hydrate();
}
function renderTestLog() {
	return testLog.length
		? testLog
				.map(
					(entry) =>
						/* html*/ `<article class="test-row"><b class="${entry.tone === 'success' ? 'pass' : entry.tone === 'error' ? 'fail' : 'info'}">${escapeHtml(entry.title)}</b><p>${escapeHtml(entry.detail)}</p></article>`
				)
				.join('')
		: '<article class="test-row"><b class="info">Awaiting a run</b><p>Choose “Run all checks” to populate expected outputs.</p></article>';
}
async function hydrate() {
	try {
		await db.ready();
		requiredElement('#connectionState').textContent = `${db.dbName} ready`;
		requiredElement('#metricTables').textContent = String(db.tableList.length);
		requiredElement('#metricVersion').textContent = `v${db.version}`;
		await refreshSelects();
	} catch (error) {
		console.error(error);
		showToast('error', errorMessage(error));
	}
}
function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}
async function ensureSeeded() {
	if (!(await db.from('users').count()))
		await db.seed('users', [
			{ name: 'Ada', email: 'ada@locality.dev', score: 12 },
			{ name: 'Grace', email: 'grace@locality.dev', score: 8 },
		]);
	const users = await getRows('users');
	if (!(await db.from('posts').count()))
		await db.seed('posts', [
			{ userId: users[0].id, title: 'Index-friendly queries', likes: 7 },
			{
				userId: users[Math.min(1, users.length - 1)].id,
				title: 'Atomic transactions',
				likes: 13,
			},
		]);
	const posts = await getRows('posts');
	if (!(await db.from('comments').count()) && posts[0])
		await db.seed('comments', [{ postId: posts[0].id, body: 'A real ref relationship.' }]);
	if (!(await db.from('auditLogs').count()))
		await db.insert('auditLogs').values({ event: 'Demo seed created' }).run();
}
async function confirmAction(title: string, description: string) {
	dialogTitle.textContent = title;
	dialogDescription.textContent = description;
	dialog.showModal();
	return await new Promise<boolean>((resolve) =>
		dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), {
			once: true,
		})
	);
}
async function runCurrentOperation() {
	const control = currentOperation().control;
	try {
		let result: unknown;
		switch (control) {
			case 'snapshot':
				result = {
					dbName: db.dbName,
					version: db.version,
					tableList: db.tableList,
					schema: Object.fromEntries(
						Object.entries(schema).map(([name, table]) => [
							name,
							Object.keys(table.columns),
						])
					),
				};
				break;
			case 'details': {
				const raw = await db.getDBInstance();
				result = {
					dbName: db.dbName,
					version: db.version,
					tableList: db.tableList,
					raw: {
						name: raw.name,
						version: raw.version,
						stores: [...raw.objectStoreNames],
					},
					databases: await db.dbList,
				};
				break;
			}
			case 'utilities': {
				const uuid = uuidV4();
				const timestamp = getTimestamp();
				result = {
					int: validateColumnType('int', 42),
					badInt: validateColumnType('int', 'forty-two'),
					uuid,
					timestamp,
					isEmail: isEmail('ada@locality.dev'),
					isURL: isURL('https://locality.dev'),
					isUUID: isUUID(uuid),
					isTimestamp: isTimestamp(timestamp),
				};
				break;
			}
			case 'insert': {
				const table = getValueOf('insertTable');
				if (table === 'users')
					result = await db
						.insert('users')
						.values({
							name: getValueOf('insertName'),
							email: getValueOf('insertEmail') as Email,
							score: Number(getValueOf('insertScore')),
						})
						.run();
				else
					result = await db
						.insert('posts')
						.values({
							userId: Number(getValueOf('insertUserId')),
							title: getValueOf('insertTitle'),
							likes: Number(getValueOf('insertLikes')),
						})
						.run();
				break;
			}
			case 'batch':
				result = await db
					.insert('users')
					.values([
						{
							name: 'Batch Alpha',
							email: `batch-alpha-${Date.now()}@locality.dev`,
							score: 2,
						},
						{
							name: 'Batch Beta',
							email: `batch-beta-${Date.now()}@locality.dev`,
							score: 3,
						},
					])
					.run();
				break;
			case 'seed':
				await ensureSeeded();
				result = {
					message: 'Seeded related tables',
					users: await db.from('users').count(),
					posts: await db.from('posts').count(),
					comments: await db.from('comments').count(),
				};
				break;
			case 'read':
				await ensureSeeded();
				result = {
					users: await db
						.from('users')
						.where('score', IDBKeyRange.lowerBound(5))
						.select({ id: true, name: true, score: true })
						.findAll(),
					firstPopular: await db
						.from('posts')
						.where((post) => post.likes >= 5)
						.findFirst(),
				};
				break;
			case 'lookup': {
				await ensureSeeded();
				const userId = Number(getValueOf('lookupUser'));
				result = {
					byPrimaryKey: await db.from('users').findByPk(userId),
					byEmailIndex: await db
						.from('users')
						.findByIndex('email', 'ada@locality.dev'),
					postsByUserIndex: await db.from('posts').findByIndex('userId', userId),
				};
				break;
			}
			case 'sort':
				await ensureSeeded();
				result = {
					usersInMemory: await db
						.from('users')
						.orderBy('name', 'asc')
						.limit(3)
						.findAll(),
					postsCursor: await db
						.from('posts')
						.sortByIndex('likes', 'desc')
						.limit(3)
						.findAll(),
				};
				break;
			case 'aggregate':
				await ensureSeeded();
				result = {
					count: await db.from('posts').count(),
					exists: await db
						.from('posts')
						.where('likes', IDBKeyRange.lowerBound(10))
						.exists(),
					sum: await db.from('posts').sum('likes'),
					avg: await db.from('posts').avg('likes'),
					min: await db.from('posts').min('likes'),
					max: await db.from('posts').max('likes'),
					titles: await db.from('posts').distinct('title'),
				};
				break;
			case 'cursor': {
				await ensureSeeded();
				const titles: string[] = [];
				const page = await db.from('posts').sortByIndex('id').page({ limit: 2 });
				await db
					.from('posts')
					.sortByIndex('id')
					.stream((post, index) => {
						titles.push(`${index}: ${post.title}`);
					});
				result = { page, streamed: titles };
				break;
			}
			case 'update': {
				await ensureSeeded();
				const userId = Number(getValueOf('updateUser'));
				const postId = Number(getValueOf('updatePost'));
				result = {
					userRowsUpdated: await db
						.update('users')
						.set((user) => ({ score: user.score + 1 }))
						.where('id', userId)
						.run(),
					postRowsUpdated: await db
						.update('posts')
						.set({ likes: Number(getValueOf('updateLikes')) })
						.where('id', postId)
						.run(),
				};
				break;
			}
			case 'delete': {
				const table = getValueOf('deleteTable');
				const isUser = table === 'users';
				const id = Number(getValueOf(isUser ? 'deleteUser' : 'deletePost'));
				if (!id) throw new Error('Seed records before choosing a delete target.');
				const ok = await confirmAction(
					`Delete ${table} row?`,
					isUser
						? 'This will cascade to the selected user’s posts and comments.'
						: 'This permanently removes the selected post and its comments.'
				);
				if (!ok) return;
				result = isUser
					? {
							deleted: await db.delete('users').where('id', id).run(),
							cascade: 'Related posts/comments were considered by ref policies.',
						}
					: { deleted: await db.delete('posts').where('id', id).run() };
				break;
			}
			case 'reference':
				await db
					.insert('posts')
					.values({ userId: 999_999, title: 'Rejected reference', likes: 1 })
					.run();
				break;
			case 'transaction':
				await db.transaction(['users', 'posts'], async (ctx) => {
					const user = await ctx
						.insert('users')
						.values({
							name: 'Transaction user',
							email: `transaction-${Date.now()}@locality.dev`,
							score: 4,
						})
						.run();
					await ctx
						.insert('posts')
						.values({ userId: user.id, title: 'Committed together', likes: 1 })
						.run();
				});
				result = {
					message: 'Transaction committed. Both rows were written atomically.',
				};
				break;
			case 'export-object':
				result = await db.exportToObject({
					tables: ['users', 'posts'],
					includeMetadata: true,
				});
				break;
			case 'export-file':
				await db.$export({
					tables: ['users', 'posts', 'comments'],
					filename: 'locality-api-lab.json',
					pretty: true,
					includeMetadata: true,
				});
				result = { message: 'Download triggered by $export().' };
				break;
			case 'import': {
				const backup = await db.exportToObject({ tables: ['users', 'posts'] });
				await db.$import(backup, {
					mode: getValueOf('importMode') as ImportMode,
				});
				result = {
					message: `Imported a live snapshot using ${getValueOf('importMode')}.`,
					metadata: backup.metadata,
				};
				break;
			}
			default:
				return;
		}
		updateResult(result);
		showToast('success', `${currentOperation().title} completed.`);
		await refreshSelects();
	} catch (error) {
		updateResult({ error: errorMessage(error) });
		showToast('error', errorMessage(error));
		console.error(error);
	}
}
function getValueOf(id: string) {
	return document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.value ?? '';
}
async function runRollback() {
	try {
		await db.transaction(['users', 'posts'], async (ctx) => {
			await ctx
				.insert('users')
				.values({
					name: 'Rollback user',
					email: `rollback-${Date.now()}@locality.dev`,
					score: 0,
				})
				.run();
			throw new Error('Intentional rollback');
		});
	} catch (error) {
		updateResult({
			expectedError: errorMessage(error),
			verified: 'The transaction was aborted; the inserted user was not committed.',
		});
		showToast('success', 'Rollback behaved as expected.');
		console.error(error);
	}
}
async function runMaintenance(action: 'clear-table' | 'clear-all') {
	const table = getValueOf('maintenanceTable') as TableName;
	const description =
		action === 'clear-all'
			? 'This permanently removes all rows from every active table.'
			: `This permanently removes all rows from ${table}.`;
	if (
		!(await confirmAction(
			action === 'clear-all' ? 'Clear all tables?' : `Clear ${table}?`,
			description
		))
	)
		return;
	if (action === 'clear-all') await db.clearAll();
	else await db.clearTable(table);
	updateResult({
		message: action === 'clear-all' ? 'All tables cleared.' : `${table} cleared.`,
	});
	showToast('success', 'Maintenance action complete.');
	await refreshSelects();
}
async function runDeleteDatabase() {
	const name = getValueOf('lifecycleDb');
	if (!name) return;
	if (
		!(await confirmAction(
			`Delete ${name}?`,
			'The selected IndexedDB database will be permanently removed from this browser origin.'
		))
	)
		return;
	try {
		if (name === db.dbName) {
			await db.deleteDB();
			updateResult({ message: 'The active lab database was deleted. Reloading…' });
			location.reload();
			return;
		}
		await Locality.deleteDatabase(name);
		updateResult({ message: `Deleted ${name}.` });
		await refreshSelects();
	} catch (error) {
		updateResult({ error: errorMessage(error) });
		showToast('error', errorMessage(error));
		console.error(error);
	}
}
function logTest(tone: Tone, title: string, detail: string) {
	testLog.push({ tone, title, detail });
	const host = document.querySelector('#testLog');
	if (host) host.innerHTML = renderTestLog();
}
async function runTests() {
	testLog = [];
	logTest('info', 'Suite started', 'Each case clears or seeds its own state.');
	try {
		await db.clearAll();
		try {
			await db
				.insert('users')
				.values([
					{ name: 'A', email: 'same@locality.dev', score: 1 },
					{ name: 'B', email: 'same@locality.dev', score: 2 },
				])
				.run();
			logTest(
				'error',
				'Batch atomicity',
				'Unexpected success for duplicate unique email.'
			);
		} catch (error) {
			const count = await db.from('users').count();
			logTest(
				count === 0 ? 'success' : 'error',
				'Batch atomicity',
				`Expected error: ${errorMessage(error)} · persisted users: ${count}`
			);
			console.error(error);
		}
		await ensureSeeded();
		try {
			await db
				.insert('posts')
				.values({ userId: 999_999, title: 'invalid', likes: 1 })
				.run();
			logTest(
				'error',
				'Reference validation',
				'Unexpected success for an unknown parent.'
			);
		} catch (error) {
			logTest('success', 'Reference validation', errorMessage(error));
			console.error(error);
		}
		const ada = (await db.from('users').findByIndex('email', 'ada@locality.dev'))[0];
		const indexed = await db.from('users').where('email', 'ada@locality.dev').findAll();
		const page = await db.from('posts').sortByIndex('id').page({ limit: 1 });
		logTest(
			indexed.length === 1 && page.items.length === 1 ? 'success' : 'error',
			'Indexed query & page',
			`findByPk(${ada.id}) → ${Boolean(await db.from('users').findByPk(ada.id))}; index matches: ${indexed.length}; page items: ${page.items.length}`
		);
		try {
			await db.from('posts').orderBy('likes').page({ limit: 1 });
			logTest(
				'error',
				'Pagination constraint',
				'Unexpectedly allowed page() after orderBy().'
			);
		} catch (error) {
			logTest('success', 'Pagination constraint', errorMessage(error));
			console.error(error);
		}
		const preRollback = await db.from('users').count();
		try {
			await db.transaction(['users', 'posts'], async (ctx) => {
				await ctx
					.insert('users')
					.values({
						name: 'Rollback',
						email: `rollback-test-${Date.now()}@locality.dev`,
						score: 0,
					})
					.run();
				throw new Error('intentional rollback');
			});
		} catch (error) {
			/* expected */
			console.error(error);
		}
		const postRollback = await db.from('users').count();
		logTest(
			preRollback === postRollback ? 'success' : 'error',
			'Transaction rollback',
			`Users before: ${preRollback}; after rejected transaction: ${postRollback}`
		);
		const backup = await db.exportToObject({ includeMetadata: true });
		await db.clearAll();
		await db.$import(backup, { mode: 'replace' });
		logTest(
			(await db.from('users').count()) > 0 ? 'success' : 'error',
			'Export/import restore',
			`Restored ${backup.metadata?.tables.join(', ')} with replace mode.`
		);
		updateResult({
			suite: 'completed',
			passed: testLog.filter((entry) => entry.tone === 'success').length,
			output: testLog,
		});
	} catch (error) {
		logTest('error', 'Unexpected suite failure', errorMessage(error));
		console.error(error);
	}
	await refreshSelects();
}

document.addEventListener('click', (event) => {
	const target = (event.target as HTMLElement).closest<HTMLElement>(
		'[data-operation], [data-file], [data-test-file], [data-action], [data-workspace]'
	);
	if (!target) return;
	if (target.dataset.operation) {
		activeOperation = target.dataset.operation;
		activeFile = Object.keys(currentOperation().files)[0];
		renderApp();
		return;
	}
	if (target.dataset.file) {
		activeFile = target.dataset.file;
		renderApp();
		return;
	}
	if (target.dataset.testFile) {
		activeTestFile = target.dataset.testFile;
		renderApp();
		return;
	}
	if (target.dataset.workspace) {
		document.querySelectorAll('.main-tab').forEach((tab) => {
			tab.classList.toggle('active', tab === target);
		});
		document
			.querySelector('#interactPanel')!
			.classList.toggle('active', target.dataset.workspace === 'interact');
		document
			.querySelector('#testsPanel')!
			.classList.toggle('active', target.dataset.workspace === 'tests');
		return;
	}
	const action = target.dataset.action;
	if (action === 'runOperation') void runCurrentOperation();
	if (action === 'rollback') void runRollback();
	if (action === 'clear-table' || action === 'clear-all') void runMaintenance(action);
	if (action === 'delete-db') void runDeleteDatabase();
	if (action === 'run-tests') void runTests();
	if (action === 'clear-tests') {
		testLog = [];
		const host = document.querySelector('#testLog');
		if (host) host.innerHTML = renderTestLog();
	}
	if (action === 'copy-result')
		void navigator.clipboard
			?.writeText(json(lastResult))
			.then(() => showToast('success', 'Result copied to clipboard.'));
	if (action === 'console-tests')
		void import('./transaction-export')
			.then(({ runAllTests }) => runAllTests())
			.then(() =>
				showToast(
					'info',
					'transaction-export.ts ran. Open DevTools → Console to inspect its logs.'
				)
			)
			.catch((error) => showToast('error', errorMessage(error)));
});
document.addEventListener('change', (event) => {
	const target = event.target as HTMLSelectElement;
	if (target.id === 'insertTable') {
		document.querySelectorAll<HTMLElement>('[data-user-field]').forEach((field) => {
			field.hidden = target.value !== 'users';
		});
		document.querySelectorAll<HTMLElement>('[data-post-field]').forEach((field) => {
			field.hidden = target.value !== 'posts';
		});
	}
	if (target.id === 'deleteTable') {
		document.querySelector<HTMLElement>('[data-delete-users]')!.hidden =
			target.value !== 'users';
		document.querySelector<HTMLElement>('[data-delete-posts]')!.hidden =
			target.value !== 'posts';
	}
});

renderApp();
