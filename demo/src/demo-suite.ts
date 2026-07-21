import type { db as DB } from './main';

export async function runDemoSuite(
	db: typeof DB,
	pushEntry: (kind: 'info' | 'success' | 'error', message: string) => void,
	setResult: (payload: unknown) => void,
	reloadViews: () => Promise<void>,
	refreshSnapshot: () => Promise<void>
) {
	pushEntry('info', 'Starting interactive reference suite…');

	try {
		await db.clearAll();
		await db.seed('users', [
			{ name: 'Ada', email: 'ada@example.com', score: 10 },
			{ name: 'Grace', email: 'grace@example.com', score: 7 },
		]);
		const users = await db.from('users').findAll();
		await db.seed('posts', [
			{ userId: users[0].id, title: 'Ref validation', likes: 3 },
			{ userId: users[1].id, title: 'Transactions', likes: 8 },
		]);
		await db.seed('comments', [{ postId: 1, body: 'Great example' }]);

		pushEntry('success', 'Seeded the demo tables for the suite.');

		try {
			await db.insert('posts').values({ userId: 999, title: 'broken' }).run();
			pushEntry('error', 'Reference validation did not block an invalid foreign key.');
		} catch (error) {
			pushEntry(
				'success',
				`Reference validation rejected the invalid insert: ${error instanceof Error ? error.message : String(error)}`
			);
		}

		await db.transaction(['users', 'posts'], async (ctx) => {
			await ctx
				.insert('users')
				.values({ name: 'Nova', email: 'nova@example.com', score: 4 })
				.run();
			await ctx
				.insert('posts')
				.values({ userId: 3, title: 'Transaction demo', likes: 1 })
				.run();
		});
		pushEntry('success', 'Transaction context committed a multi-table insert.');

		const snapshot = await db.exportToObject({ includeMetadata: true });
		await db.clearAll();
		await db.$import(snapshot.data, { mode: 'replace' });
		pushEntry('success', 'Export/import round trip completed.');

		const result = await db
			.from('posts')
			.select({ id: true, title: true, likes: true })
			.findAll();
		setResult(result);
		await refreshSnapshot();
		await reloadViews();
		pushEntry('success', 'Reference suite completed successfully.');
	} catch (error) {
		pushEntry(
			'error',
			error instanceof Error ? error.message : 'Unexpected suite failure.'
		);
	}
}
