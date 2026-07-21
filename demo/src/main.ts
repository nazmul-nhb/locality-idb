import './style.css';

import type { InferInsertType } from 'locality';
import { column, defineSchema, deleteDB, Locality, validateColumnType } from 'locality';
import { runDemoSuite } from './demo-suite';

type OperationKind = 'info' | 'success' | 'error';

interface TerminalEntry {
	kind: OperationKind;
	message: string;
}

const schema = defineSchema({
	users: {
		id: column.int().pk().auto(),
		name: column.text(),
		email: column.text().unique(),
		score: column.int().default(0),
		createdAt: column.timestamp(),
	},
	posts: {
		id: column.int().pk().auto(),
		userId: column.int().ref('users.id', { onDelete: 'cascade', onUpdate: 'cascade' }),
		title: column.text(),
		likes: column.int().default(0),
		createdAt: column.timestamp(),
	},
	comments: {
		id: column.int().pk().auto(),
		postId: column.int().ref('posts.id', { onDelete: 'cascade', onUpdate: 'cascade' }),
		body: column.text(),
		createdAt: column.timestamp(),
	},
	auditLogs: {
		id: column.int().pk().auto(),
		event: column.text(),
		createdAt: column.timestamp(),
	},
});

export type SchemaType = typeof schema;

type InsertUser = InferInsertType<SchemaType['users']>;
type InsertPost = InferInsertType<SchemaType['posts']>;

export const db = new Locality({
	dbName: 'locality-demo-db',
	version: 3,
	schema,
});

const ui = {
	dbStatus: document.getElementById('dbStatus') as HTMLSpanElement,
	versionBadge: document.getElementById('versionBadge') as HTMLSpanElement,
	dbNameValue: document.getElementById('dbNameValue') as HTMLElement,
	versionValue: document.getElementById('versionValue') as HTMLElement,
	tableCountValue: document.getElementById('tableCountValue') as HTMLElement,
	storeListValue: document.getElementById('storeListValue') as HTMLElement,
	schemaList: document.getElementById('schemaList') as HTMLUListElement,
	resultOutput: document.getElementById('resultOutput') as HTMLPreElement,
	terminalList: document.getElementById('terminalList') as HTMLOListElement,
	insertUserBtn: document.getElementById('insertUserBtn') as HTMLButtonElement,
	insertPostBtn: document.getElementById('insertPostBtn') as HTMLButtonElement,
	seedDemoBtn: document.getElementById('seedDemoBtn') as HTMLButtonElement,
	updatePostBtn: document.getElementById('updatePostBtn') as HTMLButtonElement,
	deletePostBtn: document.getElementById('deletePostBtn') as HTMLButtonElement,
	deleteUserBtn: document.getElementById('deleteUserBtn') as HTMLButtonElement,
	loadUsersBtn: document.getElementById('loadUsersBtn') as HTMLButtonElement,
	loadPostsBtn: document.getElementById('loadPostsBtn') as HTMLButtonElement,
	countBtn: document.getElementById('countBtn') as HTMLButtonElement,
	existsBtn: document.getElementById('existsBtn') as HTMLButtonElement,
	aggregateBtn: document.getElementById('aggregateBtn') as HTMLButtonElement,
	pageBtn: document.getElementById('pageBtn') as HTMLButtonElement,
	streamBtn: document.getElementById('streamBtn') as HTMLButtonElement,
	transactionBtn: document.getElementById('transactionBtn') as HTMLButtonElement,
	exportBtn: document.getElementById('exportBtn') as HTMLButtonElement,
	importBtn: document.getElementById('importBtn') as HTMLButtonElement,
	clearAllBtn: document.getElementById('clearAllBtn') as HTMLButtonElement,
	clearTableBtn: document.getElementById('clearTableBtn') as HTMLButtonElement,
	dropTableBtn: document.getElementById('dropTableBtn') as HTMLButtonElement,
	deleteDbBtn: document.getElementById('deleteDbBtn') as HTMLButtonElement,
	runSuiteBtn: document.getElementById('runSuiteBtn') as HTMLButtonElement,
	userNameInput: document.getElementById('userNameInput') as HTMLInputElement,
	userEmailInput: document.getElementById('userEmailInput') as HTMLInputElement,
	postTitleInput: document.getElementById('postTitleInput') as HTMLInputElement,
	postUserIdInput: document.getElementById('postUserIdInput') as HTMLInputElement,
	rowIdInput: document.getElementById('rowIdInput') as HTMLInputElement,
	likesInput: document.getElementById('likesInput') as HTMLInputElement,
	tableTargetInput: document.getElementById('tableTargetInput') as HTMLInputElement,
};

const terminalEntries: TerminalEntry[] = [];

function pushEntry(kind: OperationKind, message: string) {
	terminalEntries.push({ kind, message });
	const item = document.createElement('li');
	item.className = kind;
	item.textContent = message;
	ui.terminalList.appendChild(item);
}

function setResult(payload: unknown) {
	ui.resultOutput.textContent = JSON.stringify(payload, null, 2);
}

async function refreshSnapshot() {
	await db.ready();
	ui.dbStatus.textContent = 'Ready';
	ui.versionBadge.textContent = `v${db.version}`;
	ui.dbNameValue.textContent = db.dbName;
	ui.versionValue.textContent = String(db.version);
	ui.tableCountValue.textContent = String(db.tableList.length);
	ui.storeListValue.textContent = db.tableList.join(', ') || '—';

	ui.schemaList.innerHTML = '';
	for (const [tableName, table] of Object.entries(schema)) {
		const item = document.createElement('li');
		item.textContent = `${tableName}: ${Object.keys(table.columns).join(', ')}`;
		ui.schemaList.appendChild(item);
	}
}

async function ensureSeedData() {
	const count = await db.from('users').count();
	if (count > 0) return;

	await db.seed('users', [
		{ name: 'Ada', email: 'ada@example.com', score: 10 },
		{ name: 'Grace', email: 'grace@example.com', score: 7 },
	]);

	const users = await db.from('users').findAll();
	await db.seed('posts', [
		{ userId: users[0].id, title: 'Ref validation', likes: 3 },
		{ userId: users[1].id, title: 'Transactions', likes: 8 },
	]);

	await db.seed('comments', [
		{ postId: 1, body: 'Great example' },
		{ postId: 2, body: 'Works well' },
	]);

	await db.insert('auditLogs').values({ event: 'seed' }).run();
	pushEntry('success', 'Seeded demo data into users, posts, comments, and auditLogs.');
}

async function reloadViews() {
	await refreshSnapshot();
	const [users, posts] = await Promise.all([
		db.from('users').findAll(),
		db.from('posts').findAll(),
	]);
	setResult({ users, posts });
}

async function handleInsertUser() {
	const payload: InsertUser = {
		name: ui.userNameInput.value.trim(),
		email: ui.userEmailInput.value.trim(),
		score: 1,
	};

	const inserted = await db.insert('users').values(payload).run();
	setResult(inserted);
	pushEntry('success', `Inserted user ${inserted.name}`);
	await reloadViews();
}

async function handleInsertPost() {
	const payload: InsertPost = {
		userId: Number(ui.postUserIdInput.value),
		title: ui.postTitleInput.value.trim(),
		likes: 1,
	};

	const inserted = await db.insert('posts').values(payload).run();
	setResult(inserted);
	pushEntry('success', `Inserted post ${inserted.title}`);
	await reloadViews();
}

async function handleUpdatePost() {
	const id = Number(ui.rowIdInput.value);
	const likes = Number(ui.likesInput.value);
	const updated = await db
		.update('posts')
		.set({ likes })
		.where((row) => row.id === id)
		.run();
	setResult({ updated });
	pushEntry('success', `Updated ${updated} post rows.`);
	await reloadViews();
}

async function handleDeletePost() {
	const id = Number(ui.rowIdInput.value);
	const deleted = await db
		.delete('posts')
		.where((row) => row.id === id)
		.run();
	setResult({ deleted });
	pushEntry('success', `Deleted ${deleted} post row(s).`);
	await reloadViews();
}

async function handleDeleteUser() {
	const id = Number(ui.rowIdInput.value);
	const deleted = await db
		.delete('users')
		.where((row) => row.id === id)
		.run();
	setResult({ deleted });
	pushEntry('success', `Deleted ${deleted} user row(s).`);
	await reloadViews();
}

async function runQueryDemo() {
	const users = await db
		.from('users')
		.where((row) => row.email.includes('@'))
		.select({ id: true, name: true, email: true })
		.findAll();
	const posts = await db
		.from('posts')
		.where((row) => row.likes > 0)
		.select({ id: true, title: true, likes: true })
		.findAll();
	setResult({ users, posts });
	pushEntry('info', 'Executed where/select queries against users and posts.');
}

async function runCountExists() {
	const [count, exists] = await Promise.all([
		db.from('posts').count(),
		db
			.from('users')
			.where((row) => row.email === 'ada@example.com')
			.exists(),
	]);
	setResult({ count, exists });
	pushEntry('info', 'Ran count() and exists() for the current dataset.');
}

async function runAggregation() {
	const [sum, avg, distinct, min, max] = await Promise.all([
		db.from('posts').sum('likes'),
		db.from('posts').avg('likes'),
		db.from('posts').distinct('title'),
		db.from('posts').min('likes'),
		db.from('posts').max('likes'),
	]);
	setResult({ sum, avg, distinct, min, max });
	pushEntry('info', 'Computed aggregation helpers over the posts table.');
}

async function runPagination() {
	const page = await db.from('posts').sortByIndex('id').page({ limit: 2 });
	setResult(page);
	pushEntry('info', 'Paged through the posts table with page().');
}

async function runStream() {
	const streamed: string[] = [];
	await db
		.from('posts')
		.sortByIndex('id')
		.stream((row) => {
			streamed.push(row.title);
		});
	setResult({ streamed });
	pushEntry('info', 'Streamed rows from the posts store.');
}

async function runTransaction() {
	await db.transaction(['users', 'posts'], async (ctx) => {
		const insertedUser = await ctx
			.insert('users')
			.values({ name: 'Nova', email: 'nova@example.com', score: 3 })
			.run();
		await ctx
			.insert('posts')
			.values({ userId: insertedUser.id, title: 'Transaction demo', likes: 4 })
			.run();
	});
	setResult({ message: 'Transaction committed successfully' });
	pushEntry(
		'success',
		'Committed a multi-table transaction with insert() from the transaction context.'
	);
	await reloadViews();
}

async function runExportImport() {
	const exported = await db.exportToObject({ includeMetadata: true });
	await db.clearAll();
	await db.$import(exported.data, { mode: 'replace' });
	setResult(exported);
	pushEntry('success', 'Exported data and restored it through $import().');
	await reloadViews();
}

async function handleClearAll() {
	await db.clearAll();
	pushEntry('success', 'Cleared all rows from every table.');
	await reloadViews();
}

async function handleClearTable() {
	const tableName = ui.tableTargetInput.value.trim() || 'posts';
	await db.clearTable(tableName as keyof typeof schema);
	pushEntry('success', `Cleared table ${tableName}.`);
	await reloadViews();
}

async function handleDropTable() {
	await db.dropTable('auditLogs');
	pushEntry('success', 'Dropped the auditLogs table.');
	await reloadViews();
}

async function handleDeleteDb() {
	await db.deleteDB();
	await deleteDB(db.dbName);
	pushEntry('info', 'Deleted the database from IndexedDB.');
	window.location.reload();
}

async function handleAppInit() {
	await refreshSnapshot();
	await ensureSeedData();
	await reloadViews();
	pushEntry('info', 'Locality demo loaded and ready.');
}

function bindTabs() {
	for (const button of document.querySelectorAll<HTMLButtonElement>('.tab-btn')) {
		button.addEventListener('click', () => {
			for (const tab of document.querySelectorAll<HTMLElement>('.panel')) {
				tab.classList.toggle('active', tab.id === `${button.dataset.target}`);
			}
			for (const tabButton of document.querySelectorAll<HTMLButtonElement>('.tab-btn')) {
				tabButton.classList.toggle('active', tabButton === button);
			}
		});
	}
}

function bindEvents() {
	ui.insertUserBtn.addEventListener('click', () => {
		void handleInsertUser();
	});
	ui.insertPostBtn.addEventListener('click', () => {
		void handleInsertPost();
	});
	ui.seedDemoBtn.addEventListener('click', () => {
		void ensureSeedData();
	});
	ui.updatePostBtn.addEventListener('click', () => {
		void handleUpdatePost();
	});
	ui.deletePostBtn.addEventListener('click', () => {
		void handleDeletePost();
	});
	ui.deleteUserBtn.addEventListener('click', () => {
		void handleDeleteUser();
	});
	ui.loadUsersBtn.addEventListener('click', () => {
		void runQueryDemo();
	});
	ui.loadPostsBtn.addEventListener('click', () => {
		void runQueryDemo();
	});
	ui.countBtn.addEventListener('click', () => {
		void runCountExists();
	});
	ui.existsBtn.addEventListener('click', () => {
		void runCountExists();
	});
	ui.aggregateBtn.addEventListener('click', () => {
		void runAggregation();
	});
	ui.pageBtn.addEventListener('click', () => {
		void runPagination();
	});
	ui.streamBtn.addEventListener('click', () => {
		void runStream();
	});
	ui.transactionBtn.addEventListener('click', () => {
		void runTransaction();
	});
	ui.exportBtn.addEventListener('click', () => {
		void runExportImport();
	});
	ui.importBtn.addEventListener('click', () => {
		void runExportImport();
	});
	ui.clearAllBtn.addEventListener('click', () => {
		void handleClearAll();
	});
	ui.clearTableBtn.addEventListener('click', () => {
		void handleClearTable();
	});
	ui.dropTableBtn.addEventListener('click', () => {
		void handleDropTable();
	});
	ui.deleteDbBtn.addEventListener('click', () => {
		void handleDeleteDb();
	});
	ui.runSuiteBtn.addEventListener('click', () => {
		void runDemoSuite(db, pushEntry, setResult, reloadViews, refreshSnapshot);
	});
}

void (async () => {
	bindTabs();
	bindEvents();
	try {
		await handleAppInit();
		pushEntry('info', `Validation helper: ${validateColumnType('int', 3)}`);
	} catch (error) {
		pushEntry(
			'error',
			error instanceof Error ? error.message : 'Unexpected failure during initialization.'
		);
	}
})();
