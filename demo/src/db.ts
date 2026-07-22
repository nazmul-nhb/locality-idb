import { column, defineSchema, Locality } from 'locality';

export const schema = defineSchema({
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

export type TableName = keyof typeof schema;

export async function getRows(table: TableName) {
	return await db.from(table).sortByIndex('id').findAll();
}
