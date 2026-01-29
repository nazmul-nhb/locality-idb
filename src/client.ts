import { IsAutoInc, IsPrimaryKey } from './core';
import { openDBWithStores } from './factory';
import { DeleteQuery, InsertQuery, SelectQuery, UpdateQuery } from './query';
import type {
	$InferRow,
	InferInsertType,
	InferSelectType,
	LocalityConfig,
	SchemaDefinition,
	StoreConfig,
} from './types';

/**
 * @class `Locality` class for `IndexedDB` interactions.
 *
 * @example
 * import { column, defineSchema, Locality } from 'locality-idb';
 *
 * const schema = defineSchema({
 *   users: {
 *     id: column.int().pk().auto(),
 *     name: column.text(),
 *     email: column.text().unique(),
 *   },
 * });
 *
 * const db = new Locality({
 *   dbName: 'my-database',
 *   version: 1,
 *   schema,
 * });
 *
 * // Optional
 * await db.ready();
 *
 * // Insert a new user
 * const inserted = await db.insert('users').values({ name: 'Alice', email: 'alice@wonderland.mad' }).run();
 *
 * // Get all users
 * const allUsers = await db.from('users').all();
 *
 * // Select users with a specific condition
 * const allAlices = await db.from('users').where((user) => user.email.includes('alice')).all();
 *
 * // Update a user
 * const updated = await db.update('users').set({ name: 'Alice Liddell' }).where((user) => user.id === 1).run();
 *
 * // Delete a user
 * const deleted = await db.delete('users').where((user) => user.id === 1).run();
 */
export class Locality<
	DBName extends string = string,
	Version extends number = 1,
	Schema extends SchemaDefinition = SchemaDefinition,
> {
	readonly #name: DBName;
	readonly #schema: Schema;
	readonly #version?: Version;

	#db!: IDBDatabase;
	#readyPromise: Promise<void>;

	constructor(config: LocalityConfig<DBName, Version, Schema>) {
		this.#name = config.dbName;
		this.#schema = config.schema;
		this.#version = config.version;

		const store = this.#buildStoresConfig();

		this.#readyPromise = openDBWithStores(this.#name, store, this.#version).then((db) => {
			this.#db = db;
		});
	}

	/** Build store configurations from schema. */
	#buildStoresConfig(): StoreConfig[] {
		return Object.entries(this.#schema).map(([tableName, table]) => {
			const columns = table.columns;
			const pk = Object.values(columns).find((col) => col[IsPrimaryKey]);

			const autoInc = pk?.[IsAutoInc] || false;

			// TODO: Handle multiple primary keys later
			const pkName = Object.entries(columns).find(([_, col]) => col[IsPrimaryKey])?.[0];

			// if (!pkName) {
			// 	throw new Error(`Table "${tableName}" must have a primary key column.`);
			// }

			return {
				name: tableName,
				keyPath: pkName,
				autoIncrement: autoInc,
			};
		});
	}

	/** @instance Waits for database initialization to complete. */
	async ready(): Promise<void> {
		return this.#readyPromise;
	}

	/**
	 * @instance Select records from a table.
	 * @param table Table name.
	 * @returns
	 */
	from<T extends keyof Schema, Row extends $InferRow<Schema[T]['columns']>>(table: T) {
		return new SelectQuery<Row, null>(table as string, () => this.#db, this.#readyPromise);
	}

	/**
	 * @instance Insert records into a table.
	 * @param table Table name.
	 */
	insert<
		T extends keyof Schema,
		Raw extends InferInsertType<Schema[T]>,
		Inserted,
		Data extends InferSelectType<Schema[T]>,
		Return extends Inserted extends Array<infer _> ? Data[] : Data,
	>(table: T) {
		return new InsertQuery<Raw, Inserted, Data, Return>(
			table as string,
			() => this.#db,
			this.#readyPromise,
			this.#schema[table].columns
		);
	}

	/**
	 * @instance Update records in a table.
	 * @param table Table name.
	 */
	update<T extends keyof Schema, Row extends $InferRow<Schema[T]['columns']>>(table: T) {
		return new UpdateQuery<Row, Schema[T]>(
			table as string,
			() => this.#db,
			this.#readyPromise
		);
	}

	/**
	 * @instance Delete records from a table.
	 * @param table Table name.
	 */
	delete<T extends keyof Schema, Row extends $InferRow<Schema[T]['columns']>>(table: T) {
		const columns = this.#schema[table].columns;
		const keyField = Object.entries(columns).find(([_, col]) => col[IsPrimaryKey])?.[0];

		return new DeleteQuery<Row, keyof Row>(
			table as string,
			() => this.#db,
			this.#readyPromise,
			keyField as keyof Row
		);
	}
}
