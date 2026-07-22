import type { InferInsertType, InferSelectType } from 'locality';
import { column, defineSchema, Locality } from 'locality';
import { Stylog } from 'toolbox-x/stylog';
import { errorMessage } from './utils';

// Test schema
const testSchema = defineSchema({
	users: {
		id: column.int().pk().auto(),
		name: column.text(),
		email: column.text().unique(),
		createdAt: column.timestamp(),
	},
	posts: {
		id: column.int().pk().auto(),
		userId: column.int().index(),
		title: column.text(),
		content: column.text(),
		createdAt: column.timestamp(),
	},
	comments: {
		id: column.int().pk().auto(),
		postId: column.int().index(),
		userId: column.int().index(),
		text: column.text(),
		createdAt: column.timestamp(),
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
	Stylog.info.bold.log('\n🧪 Testing Bulk Insert Atomicity...');

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
			Stylog.cyan.italic.log(
				'❌ FAIL: Expected duplicate email error but insert succeeded'
			);
		} catch (error) {
			Stylog.cyan.italic.log(`✅ Expected error caught: ${errorMessage(error)}`);

			// Check that NO users were inserted (atomicity)
			const allUsers = await db.from('users').findAll();
			if (allUsers.length === 0) {
				Stylog.success.bold.log(
					'✅ PASS: All-or-nothing atomicity verified - no users inserted'
				);
			} else {
				Stylog.cyan.italic.bold.log(
					`❌ FAIL: Found ${allUsers.length} users - atomicity violated!`
				);
				console.table(allUsers);
			}
		}
	} catch (error) {
		console.error('❌ Test failed with unexpected error:', error);
	}
}

export async function testTransaction() {
	Stylog.info.bold.log('\n🧪 Testing Transaction Method...');

	try {
		// Clear existing data
		await db.clearTable('users');
		await db.clearTable('posts');

		// Test successful transaction
		await db.transaction(['users', 'posts'], async (ctx) => {
			const newUser = await ctx
				.insert('users')
				.values({
					name: 'Transaction User',
					email: 'tx-user@test.com',
				})
				.run();

			await ctx
				.insert('posts')
				.values({
					userId: newUser.id,
					title: 'First Post',
					content: 'Created in transaction',
				})
				.run();

			Stylog.success.bold.log('✅ Transaction operations completed');
		});

		const users = await db.from('users').findAll();
		const posts = await db.from('posts').findAll();

		if (users.length === 1 && posts.length === 1) {
			Stylog.success.bold.log('✅ PASS: Transaction committed successfully');

			Stylog.info.underline.bold.log('User:');
			console.table([users[0]]);

			Stylog.info.underline.bold.log('Post:');
			console.table([posts[0]]);
		} else {
			Stylog.cyan.bold.log('❌ FAIL: Expected 1 user and 1 post');
		}

		// Test transaction rollback
		await db.clearTable('users');
		await db.clearTable('posts');

		try {
			await db.transaction(['users', 'posts'], async (ctx) => {
				const newUser = await ctx
					.insert('users')
					.values({
						name: 'Rollback User',
						email: 'rollback@test.com',
					})
					.run();

				await ctx
					.delete('users')
					.where((u) => u.id === newUser.id)
					.run();

				await ctx
					.insert('posts')
					.values({
						userId: newUser.id,
						title: 'Post 1',
						content: 'First post',
					})
					.run();

				const p = await ctx.from('posts').select({ title: true }).findAll();

				Stylog.info.underline.bold.log('Title Only:');
				console.table(p);

				// Intentionally throw error to trigger rollback
				throw new Error('Intentional error to test rollback');
			});

			Stylog.cyan.italic.log('❌ FAIL: Expected error to be thrown');
		} catch (error) {
			Stylog.cyan.italic.log(`✅ Expected error caught: ${errorMessage(error)}`);

			// Verify rollback
			const usersAfterRollback = await db.from('users').findAll();
			const postsAfterRollback = await db.from('posts').findAll();

			if (usersAfterRollback.length === 0 && postsAfterRollback.length === 0) {
				Stylog.success.bold.log(
					'✅ PASS: Transaction rolled back successfully - no data inserted'
				);
			} else {
				Stylog.cyan.italic.log(
					'❌ FAIL: Data found after rollback - transaction did not rollback!'
				);
			}
		}
	} catch (error) {
		console.error('❌ Test failed with unexpected error:', error);
	}
}

export async function testExport() {
	Stylog.info.bold.log('\n🧪 Testing Export Method...');

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

		Stylog.success.bold.log('✅ Data seeded successfully');

		// Export all tables
		Stylog.info.bold.log('📦 Triggering export (check downloads folder)...');
		await db.$export({
			// filename: 'test-export.json',
			pretty: true,
			includeMetadata: true,
		});

		Stylog.success.bold.log('✅ PASS: Export method executed successfully');
		Stylog.info.bold.italic.log('  Check your downloads for: test-export.json');

		// Export specific tables
		Stylog.info.bold.log('📦 Exporting only users table...');
		await db.$export({
			tables: ['users'],
			// filename: 'test-export-users-only.json',
			pretty: true,
		});

		Stylog.success.bold.log('✅ PASS: Selective export executed successfully');
		Stylog.bold.italic.bold.log('  Check your downloads for: test-export-users-only.json');
	} catch (error) {
		console.error('❌ Test failed:', error);
	}
}

// Run all tests
export async function runAllTests() {
	Stylog.yellow.bold.log('🚀 Running New Features Tests...\n');

	await db.ready();

	await testBulkInsertAtomicity();
	// await testExport();
	await testTransaction();

	Stylog.success.bold.log('\n✨ All tests completed!\n');
}
