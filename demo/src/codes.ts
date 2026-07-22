/** biome-ignore-all lint/suspicious/noTemplateCurlyInString: written in code snippets */

export type Operation = {
	id: string;
	group: string;
	title: string;
	description: string;
	note?: string;
	files: Record<string, string>;
	control: string;
};

export const code = (lines: string[]) => lines.join('\n');

export function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export function getValueOf(id: string) {
	return document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.value ?? '';
}

export const operations: Operation[] = [
	{
		id: 'initialize',
		group: 'Setup',
		title: 'Schema & initialization',
		description:
			'The demo schema uses four related stores, IndexedDB indexes, defaults, timestamps, and cascade policies.',
		files: {
			'schema.ts': code([
				'const schema = defineSchema({',
				'  users: { id: column.int().pk().auto(), email: column.email().unique() },',
				"  posts: { userId: column.int().ref('users.id', { onDelete: 'cascade', onUpdate: 'cascade' }).index() },",
				"  comments: { postId: column.int().ref('posts.id', { onDelete: 'cascade' }).index() },",
				'});',
				'',
				"export const db = new Locality({ dbName: 'locality-api-lab', version: 4, schema });",
			]),
		},
		control: 'snapshot',
	},
	{
		id: 'database-details',
		group: 'Setup',
		title: 'Ready & database metadata',
		description:
			'Inspect instance metadata, currently registered stores, the raw IDB connection, and databases available to this origin.',
		files: {
			'database.ts': code([
				'await db.ready();',
				'const raw = await db.getDBInstance();',
				'const databases = await db.dbList;',
				'',
				'console.log({',
				'  dbName: db.dbName,',
				'  version: db.version,',
				'  tableList: db.tableList,',
				'  rawName: raw.name,',
				'  databases,',
				'});',
			]),
		},
		control: 'details',
	},
	{
		id: 'utilities',
		group: 'Setup',
		title: 'Validation & utility helpers',
		description:
			'Run Locality’s exported validators and ID/date helpers. These are useful before a write and mirror the validation system used by query builders.',
		files: {
			'utilities.ts': code([
				'const report = {',
				"  int: validateColumnType('int', 42),",
				"  badInt: validateColumnType('int', 'forty-two'),",
				'  uuid: uuidV4(),',
				'  timestamp: getTimestamp(),',
				"  isEmail: isEmail('ada@locality.dev'),",
				"  isURL: isURL('https://locality.dev'),",
				'  isUUID: isUUID(uuidV4()),',
				'  isTimestamp: isTimestamp(getTimestamp()),',
				'};',
			]),
		},
		control: 'utilities',
	},
	{
		id: 'insert',
		group: 'Write',
		title: 'Insert a row',
		description:
			'Insert a typed user or a post. Posts use a select populated from real user rows, so the foreign key is never hand typed.',
		files: {
			'users.ts': code([
				'const inserted = await db',
				"  .insert('users')",
				'  .values({ name, email, score: Number(score) })',
				'  .run();',
			]),
			'posts.ts': code([
				'const inserted = await db',
				"  .insert('posts')",
				'  .values({ userId: Number(userId), title, likes: Number(likes) })',
				'  .run();',
			]),
		},
		control: 'insert',
	},
	{
		id: 'batch-insert',
		group: 'Write',
		title: 'Batch insert & atomicity',
		description:
			'A single values(array) call inserts multiple rows in one IndexedDB transaction. A duplicate unique value aborts the whole batch.',
		files: {
			'users.ts': code([
				'const inserted = await db',
				"  .insert('users')",
				'  .values([',
				"    { name: 'Ada', email: 'ada@locality.dev', score: 12 },",
				"    { name: 'Grace', email: 'grace@locality.dev', score: 8 },",
				'  ])',
				'  .run();',
			]),
		},
		control: 'batch',
	},
	{
		id: 'seed',
		group: 'Write',
		title: 'Seed related data',
		description:
			'seed() is a convenience wrapper around batch insertion. It adds rows without clearing existing contents.',
		files: {
			'users.ts': code([
				"await db.seed('users', [",
				"  { name: 'Ada', email: 'ada@locality.dev', score: 12 },",
				"  { name: 'Grace', email: 'grace@locality.dev', score: 8 },",
				']); ',
			]),
			'posts.ts': code([
				"const users = await db.from('users').findAll();",
				"await db.seed('posts', [",
				"  { userId: users[0].id, title: 'Index-friendly queries', likes: 7 },",
				"  { userId: users[1].id, title: 'Atomic transactions', likes: 13 },",
				']); ',
			]),
		},
		control: 'seed',
	},
	{
		id: 'read',
		group: 'Read',
		title: 'Read, project & first match',
		description:
			'findAll(), findFirst(), select(), predicate where(), and index where() use one fluent query surface.',
		files: {
			'users.ts': code([
				'const users = await db',
				"  .from('users')",
				"  .where('score', IDBKeyRange.lowerBound(5))",
				'  .select({ id: true, name: true, score: true })',
				'  .findAll();',
			]),
			'posts.ts': code([
				'const firstPopular = await db',
				"  .from('posts')",
				'  .where((post) => post.likes >= 5)',
				'  .findFirst();',
			]),
		},
		control: 'read',
	},
	{
		id: 'lookup',
		group: 'Read',
		title: 'Primary-key & index lookup',
		description:
			'findByPk() is an O(1) primary-key lookup; findByIndex() gets the matching indexed records.',
		files: {
			'users.ts': code([
				"const user = await db.from('users').findByPk(Number(userId));",
				'const matches = await db',
				"  .from('users')",
				"  .findByIndex('email', 'ada@locality.dev');",
			]),
			'posts.ts': code([
				'const posts = await db',
				"  .from('posts')",
				"  .findByIndex('userId', Number(userId));",
			]),
		},
		control: 'lookup',
	},
	{
		id: 'sort-limit',
		group: 'Read',
		title: 'Sort & limit',
		description:
			'orderBy() sorts in memory, while sortByIndex() drives an IndexedDB cursor. Both compose with limit().',
		files: {
			'users.ts': code([
				'const users = await db',
				"  .from('users')",
				"  .orderBy('name', 'asc')",
				'  .limit(3)',
				'  .findAll();',
			]),
			'posts.ts': code([
				'const posts = await db',
				"  .from('posts')",
				"  .sortByIndex('likes', 'desc')",
				'  .limit(3)',
				'  .findAll();',
			]),
		},
		control: 'sort',
	},
	{
		id: 'aggregate',
		group: 'Read',
		title: 'Count, existence & aggregates',
		description:
			'Aggregate helpers use the current result set. min/max can use an indexed cursor when no filter is active.',
		files: {
			'posts.ts': code([
				'const stats = {',
				"  count: await db.from('posts').count(),",
				"  exists: await db.from('posts').where('likes', IDBKeyRange.lowerBound(10)).exists(),",
				"  sum: await db.from('posts').sum('likes'),",
				"  avg: await db.from('posts').avg('likes'),",
				"  min: await db.from('posts').min('likes'),",
				"  max: await db.from('posts').max('likes'),",
				"  titles: await db.from('posts').distinct('title'),",
				'};',
			]),
		},
		control: 'aggregate',
	},
	{
		id: 'cursor',
		group: 'Read',
		title: 'Cursor page & stream',
		description:
			'page() returns items and the next cursor. stream() visits records one by one and waits for asynchronous callbacks.',
		files: {
			'posts.ts': code([
				"const page = await db.from('posts').sortByIndex('id').page({ limit: 2 });",
				'',
				'const titles: string[] = [];',
				"await db.from('posts').sortByIndex('id').stream((post, index) => {",
				'  titles.push(`${index}: ${post.title}`);',
				'});',
			]),
		},
		control: 'cursor',
	},
	{
		id: 'update',
		group: 'Write',
		title: 'Static & computed update',
		description:
			'set() accepts an object or a callback that receives each current row. The table and record are always chosen from live selects.',
		files: {
			'users.ts': code([
				'const updated = await db',
				"  .update('users')",
				'  .set((user) => ({ score: user.score + 1 }))',
				"  .where('id', Number(userId))",
				'  .run();',
			]),
			'posts.ts': code([
				'const updated = await db',
				"  .update('posts')",
				'  .set({ likes: Number(likes) })',
				"  .where('id', Number(postId))",
				'  .run();',
			]),
		},
		control: 'update',
	},
	{
		id: 'delete',
		group: 'Write',
		title: 'Delete with cascading refs',
		description:
			'Delete selected rows through the query builder. Deleting a user cascades to their posts and comments in this schema.',
		files: {
			'users.ts': code([
				'const deleted = await db',
				"  .delete('users')",
				"  .where('id', Number(userId))",
				'  .run();',
			]),
			'posts.ts': code([
				'const deleted = await db',
				"  .delete('posts')",
				"  .where('id', Number(postId))",
				'  .run();',
			]),
		},
		control: 'delete',
	},
	{
		id: 'references',
		group: 'Integrity',
		title: 'Reference validation',
		description:
			'A child insert must point to an existing parent with the same column type. This control intentionally demonstrates the error.',
		files: {
			'posts.ts': code([
				'await db',
				"  .insert('posts')",
				"  .values({ userId: 999_999, title: 'Rejected reference', likes: 1 })",
				'  .run(); // throws because users.id does not contain 999_999',
			]),
		},
		control: 'reference',
	},
	{
		id: 'transaction',
		group: 'Integrity',
		title: 'Transaction commit & rollback',
		description:
			'Use the transaction context for all reads and writes inside the callback. A thrown error aborts every pending operation.',
		files: {
			'transaction.ts': code([
				"await db.transaction(['users', 'posts'], async (ctx) => {",
				"  const user = await ctx.insert('users').values({",
				"    name: 'Transaction user', email: 'transaction@locality.dev', score: 4",
				'  }).run();',
				"  await ctx.insert('posts').values({",
				"    userId: user.id, title: 'Committed together', likes: 1",
				'  }).run();',
				'});',
			]),
		},
		control: 'transaction',
	},
	{
		id: 'export-object',
		group: 'Backup',
		title: 'Export to an object',
		description:
			'exportToObject() provides a JSON-serializable snapshot without triggering a download.',
		files: {
			'backup.ts': code([
				'const backup = await db.exportToObject({',
				"  tables: ['users', 'posts'],",
				'  includeMetadata: true,',
				'});',
			]),
		},
		control: 'export-object',
	},
	{
		id: 'export-file',
		group: 'Backup',
		title: 'Export JSON file',
		description:
			'$export() creates the backup file and triggers the browser download. This is deliberately distinct from exportToObject().',
		files: {
			'backup.ts': code([
				'await db.$export({',
				"  tables: ['users', 'posts', 'comments'],",
				"  filename: 'locality-api-lab.json',",
				'  pretty: true,',
				'  includeMetadata: true,',
				'});',
			]),
		},
		control: 'export-file',
	},
	{
		id: 'import',
		group: 'Backup',
		title: 'Import: replace & upsert',
		description:
			'$import() accepts an export object or raw table map. Replace clears selected tables first; upsert writes by primary key.',
		files: {
			'backup.ts': code([
				"const backup = await db.exportToObject({ tables: ['users', 'posts'] });",
				"await db.$import(backup, { mode: 'replace' });",
				"await db.$import(backup.data, { mode: 'upsert' });",
			]),
		},
		control: 'import',
	},
	{
		id: 'maintenance',
		group: 'Lifecycle',
		title: 'Clear a table or all tables',
		description:
			'Maintenance APIs delete data directly. Table targets are populated from db.tableList and destructive actions ask through a modal.',
		files: {
			'maintenance.ts': code([
				'await db.clearTable(selectedTable);',
				'',
				'await db.clearAll();',
			]),
		},
		control: 'maintenance',
	},
	{
		id: 'database-lifecycle',
		group: 'Lifecycle',
		title: 'Drop, close & delete databases',
		description:
			'These lifecycle APIs are represented here with the live db list. dropTable() and close() are intentionally documented-only because each ends this long-running lab session.',
		note: 'A dropped store requires re-instantiating Locality with an updated schema/version. Closing the active connection prevents subsequent controls from running.',
		files: {
			'lifecycle.ts': code([
				"await db.dropTable('auditLogs');",
				'db.close();',
				'',
				'await db.deleteDB();',
				'await Locality.deleteDatabase(selectedDatabase);',
				'const databases = await Locality.getDatabaseList();',
			]),
		},
		control: 'lifecycle',
	},
];

export const testFiles: Record<string, string> = {
	'integrity.test.ts': code([
		'await db.clearAll();',
		"await db.insert('users').values([{ name: 'A', email: 'same@locality.dev' }, { name: 'B', email: 'same@locality.dev' }]).run();",
		'// Expected: ConstraintError and users remains empty (atomic batch).',
		'',
		"await db.insert('posts').values({ userId: 999_999, title: 'invalid' }).run();",
		'// Expected: reference error before IndexedDB writes.',
	]),
	'queries.test.ts': code([
		"const row = await db.from('users').findByPk(userId);",
		"const indexed = await db.from('users').where('email', 'ada@locality.dev').findAll();",
		"const page = await db.from('posts').sortByIndex('id').page({ limit: 1 });",
		"await db.from('posts').orderBy('likes').page({ limit: 1 });",
		'// Expected: page() rejects an in-memory orderBy.',
	]),
	'lifecycle.test.ts': code([
		"await db.transaction(['users', 'posts'], async (ctx) => {",
		"  await ctx.insert('users').values({ name: 'Rollback', email: 'rollback@locality.dev' }).run();",
		"  throw new Error('intentional rollback');",
		'});',
		'// Expected: the inserted user is absent after rejection.',
		'',
		'const backup = await db.exportToObject({ includeMetadata: true });',
		'await db.clearAll();',
		"await db.$import(backup, { mode: 'replace' });",
	]),
};
