import type { InferInsertType, InferSelectType, Timestamp } from 'locality';
import { column, defineSchema, Locality } from 'locality';
import { Chronos } from 'nhb-toolbox/chronos';

// Test schema
const testSchema = defineSchema({
	users: {
		id: column.int().pk().auto(),
		name: column.text(),
		email: column.text().unique(),
		createdAt: column.timestamp().default(new Chronos().toLocalISOString() as Timestamp),
	},
	posts: {
		id: column.int().pk().auto(),
		userId: column.int().index(),
		title: column.text(),
		content: column.text(),
		createdAt: column.timestamp().default(new Chronos().toLocalISOString() as Timestamp),
	},
	comments: {
		id: column.int().pk().auto(),
		postId: column.int().index(),
		userId: column.int().index(),
		text: column.text(),
		createdAt: column.timestamp().default(new Chronos().toLocalISOString() as Timestamp),
	},
});

type SchemaType = typeof testSchema;
export type User = InferSelectType<SchemaType['users']>;
type InsertUser = InferInsertType<SchemaType['users']>;
export type Post = InferSelectType<SchemaType['posts']>;
export type InsertPost = InferInsertType<SchemaType['posts']>;

const db = new Locality({
	dbName: 'test-features-db',
	version: 1,
	schema: testSchema,
});

export async function testBulkInsertAtomicity() {
	console.info('\n🧪 Testing Bulk Insert Atomicity...');

	try {
		// Clear existing data
		await db.clearTable('users');

		// Try to insert multiple records where one will fail (duplicate email)
		const users: InsertUser[] = [
			{ name: 'Alice', email: 'alice@test.com' },
			{ name: 'Bob', email: 'bob@test.com' },
			{ name: 'Charlie', email: 'alice@test.com' }, // Duplicate email - should fail
		];

		try {
			await db.insert('users').values(users).run();
			console.error('❌ FAIL: Expected duplicate email error but insert succeeded');
		} catch (error) {
			console.info(
				'✅ Expected error caught:',
				error instanceof Error ? error.message : error
			);

			// Check that NO users were inserted (atomicity)
			const allUsers = await db.from('users').findAll();
			if (allUsers.length === 0) {
				console.info('✅ PASS: All-or-nothing atomicity verified - no users inserted');
			} else {
				console.error(
					`❌ FAIL: Found ${allUsers.length} users - atomicity violated!`,
					allUsers
				);
			}
		}
	} catch (error) {
		console.error('❌ Test failed with unexpected error:', error);
	}
}

export async function testTransaction() {
	console.info('\n🧪 Testing Transaction Method...');

	try {
		// Clear existing data
		await db.clearTable('users');
		await db.clearTable('posts');

		// Test successful transaction
		await db.transaction(['users', 'posts'], async (tx) => {
			const userId = await tx.insert('users', {
				name: 'Transaction User',
				email: 'tx-user@test.com',
			});

			await tx.insert('posts', {
				userId: Number(userId),
				title: 'First Post',
				content: 'Created in transaction',
			});

			console.info('✅ Transaction operations completed');
		});

		const users = await db.from('users').findAll();
		const posts = await db.from('posts').findAll();

		if (users.length === 1 && posts.length === 1) {
			console.info('✅ PASS: Transaction committed successfully');
			console.info('  User:', users[0]);
			console.info('  Post:', posts[0]);
		} else {
			console.error('❌ FAIL: Expected 1 user and 1 post');
		}

		// Test transaction rollback
		await db.clearTable('users');
		await db.clearTable('posts');

		try {
			await db.transaction(['users', 'posts'], async (tx) => {
				const userId = await tx.insert('users', {
					name: 'Rollback User',
					email: 'rollback@test.com',
				});

				await tx.insert('posts', {
					userId: Number(userId),
					title: 'Post 1',
					content: 'First post',
				});

				// Intentionally throw error to trigger rollback
				throw new Error('Intentional error to test rollback');
			});

			console.error('❌ FAIL: Expected error to be thrown');
		} catch (error) {
			console.info(
				'✅ Expected error caught:',
				error instanceof Error ? error.message : error
			);

			// Verify rollback
			const usersAfterRollback = await db.from('users').findAll();
			const postsAfterRollback = await db.from('posts').findAll();

			if (usersAfterRollback.length === 0 && postsAfterRollback.length === 0) {
				console.info(
					'✅ PASS: Transaction rolled back successfully - no data inserted'
				);
			} else {
				console.error(
					'❌ FAIL: Data found after rollback - transaction did not rollback!'
				);
			}
		}
	} catch (error) {
		console.error('❌ Test failed with unexpected error:', error);
	}
}

export async function testExport() {
	console.info('\n🧪 Testing Export Method...');

	try {
		// Clear and seed data
		await db.clearTable('users');
		await db.clearTable('posts');

		await db.seed('users', [
			{ name: 'Export User 1', email: 'export1@test.com' },
			{ name: 'Export User 2', email: 'export2@test.com' },
		]);

		const users = await db.from('users').findAll();

		await db.seed('posts', [
			{ userId: users[0].id, title: 'Post 1', content: 'Content 1' },
			{ userId: users[1].id, title: 'Post 2', content: 'Content 2' },
		]);

		console.info('✅ Data seeded successfully');

		// Export all tables
		console.info('📦 Triggering export (check downloads folder)...');
		await db.export({
			filename: 'test-export.json',
			pretty: true,
			includeMetadata: true,
		});

		console.info('✅ PASS: Export method executed successfully');
		console.info('  Check your downloads for: test-export.json');

		// Export specific tables
		console.info('📦 Exporting only users table...');
		await db.export({
			tables: ['users'],
			filename: 'test-export-users-only.json',
			pretty: true,
		});

		console.info('✅ PASS: Selective export executed successfully');
		console.info('  Check your downloads for: test-export-users-only.json');
	} catch (error) {
		console.error('❌ Test failed:', error);
	}
}

// Run all tests
export async function runAllTests() {
	console.info('🚀 Running New Features Tests...\n');

	await db.ready();

	await testBulkInsertAtomicity();
	await testTransaction();
	await testExport();

	console.info('\n✨ All tests completed!\n');
}

// // Auto-run if directly loaded
// if (import.meta.url.includes('test-new-features')) {
// 	runAllTests().catch(console.error);
// }
