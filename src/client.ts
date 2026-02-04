import { IsAutoInc, IsIndexed, IsPrimaryKey, IsUnique } from './core';
import { openDBWithStores } from './factory';
import { _abortTransaction, _ensureIndexedDB, _getDBList } from './helpers';
import { DeleteQuery, InsertQuery, SelectQuery, UpdateQuery } from './query';
import type {
	$InferRow,
	ExportData,
	ExportOptions,
	GenericObject,
	IndexConfig,
	InferInsertType,
	InferSelectType,
	LocalityConfig,
	LooseLiteral,
	Maybe,
	SchemaDefinition,
	StoreConfig,
	TransactionCallback,
	TransactionContext,
} from './types';
import { deleteDB, getTimestamp } from './utils';

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
 * const allUsers = await db.from('users').findAll();
 *
 * // Select users with a specific condition
 * const allAlices = await db.from('users').where((user) => user.email.includes('alice')).findAll();
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
	TName extends keyof Schema & string = keyof Schema & string,
> {
	readonly #name: DBName;
	readonly #schema: Schema;
	// TODO: Handle multiple primary keys later
	// readonly #keyPath?: string;

	readonly #keyPaths: Record<TName, Maybe<string>>;

	readonly #configVersion: Version;

	#db!: IDBDatabase;
	#version!: Version;
	#readyPromise: Promise<void>;

	constructor(config: LocalityConfig<DBName, Version, Schema>) {
		this.#name = config.dbName;
		this.#schema = config.schema;
		this.#configVersion = (config.version ?? 1) as Version;

		const store = this.#buildStoresConfig();

		// TODO: Handle multiple primary keys later
		this.#keyPaths = store.reduce(
			(acc, { name, keyPath }) => {
				acc[name as TName] = keyPath;
				return acc;
			},
			{} as Record<TName, Maybe<string>>
		);

		this.#readyPromise = openDBWithStores(this.#name, store, config.version)
			.then((db) => {
				this.#db = db;
			})
			.finally(() => {
				this.#version = this.#db?.version as Version;
			});
	}

	get version(): Version {
		return (this.#db?.version ?? this.#version ?? this.#configVersion) as Version;
	}

	/** Build store configurations from schema. */
	#buildStoresConfig(): StoreConfig[] {
		return Object.entries(this.#schema).map(([tableName, table]) => {
			const columnEntries = Object.entries(table.columns);

			const pkEntries = columnEntries.filter(([_, col]) => col[IsPrimaryKey]);

			// Validate single primary key
			if (pkEntries.length === 0) {
				throw new RangeError(
					`Table "${tableName}" must have exactly one primary key. Found 0 primary keys.`
				);
			}

			if (pkEntries.length > 1) {
				const pkNames = pkEntries.map(([name]) => `'${name}'`).join(', ');
				throw new RangeError(
					`Table "${tableName}" can only have one primary key. Found ${pkEntries.length} primary keys: ${pkNames}.`
				);
			}

			const [pkName, pk] = pkEntries[0];
			const autoInc = pk?.[IsAutoInc] ?? false;

			// Build indexes from columns marked with index() or unique()
			const indexes: IndexConfig[] = [];

			for (const [colName, col] of columnEntries) {
				// Skip primary key columns - they are indexed by default in IndexedDB
				if (col[IsPrimaryKey]) continue;

				// Check if column is indexed (includes unique columns)
				if (col[IsIndexed]) {
					indexes.push({
						name: colName,
						keyPath: colName,
						unique: col[IsUnique] ?? false,
					});
				}
			}

			return {
				name: tableName,
				keyPath: pkName,
				autoIncrement: autoInc,
				indexes: indexes.length > 0 ? indexes : undefined,
			};
		});
	}

	#extractTablePk<T extends TName, R extends $InferRow<Schema[T]['columns']>>(table: TName) {
		const columns = this.#schema[table].columns;

		const column = Object.entries(columns).find(([_, col]) => col[IsPrimaryKey]);

		return column?.[0] as keyof R;
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
	from<T extends TName, Row extends $InferRow<Schema[T]['columns']>>(table: T) {
		return new SelectQuery<Row, null, Schema[T]>(
			table,
			() => this.#db,
			this.#readyPromise
			// this.#keyPaths[table]
		);
	}

	/**
	 * @instance Insert records into a table.
	 * @param table Table name.
	 */
	insert<
		T extends TName,
		Raw extends InferInsertType<Schema[T]>,
		Inserted extends Raw | Raw[],
		Data extends InferSelectType<Schema[T]>,
		Return extends Inserted extends Array<infer _> ? Data[] : Data,
	>(table: T) {
		return new InsertQuery<Raw, Inserted, Data, Return>(
			table,
			() => this.#db,
			this.#readyPromise,
			this.#schema[table].columns,
			this.#keyPaths[table]
		);
	}

	/**
	 * @instance Update records in a table.
	 * @param table Table name.
	 */
	update<T extends TName, Row extends $InferRow<Schema[T]['columns']>>(table: T) {
		return new UpdateQuery<Row, Schema[T]>(
			table,
			() => this.#db,
			this.#readyPromise,
			this.#schema[table].columns,
			this.#keyPaths[table]
		);
	}

	/**
	 * @instance Delete records from a table.
	 * @param table Table name.
	 */
	delete<T extends TName, Row extends $InferRow<Schema[T]['columns']>>(table: T) {
		return new DeleteQuery<Row, keyof Row>(
			table,
			() => this.#db,
			this.#readyPromise,
			this.#extractTablePk(table)
		);
	}

	/**
	 * @instance Clears all records from a specific store (table).
	 * @param table Name of the table (store) to clear.
	 */
	async clearTable<T extends TName>(table: T) {
		return new Promise<void>((resolve, reject) => {
			const transaction = this.#db.transaction(table, 'readwrite');
			const store = transaction.objectStore(table);
			const clearRequest = store.clear();

			transaction.onabort = () => _abortTransaction(transaction.error, reject);

			clearRequest.onsuccess = () => resolve();
			clearRequest.onerror = () => reject(clearRequest.error);
		});
	}

	/** @instance Closes and deletes the entire database. */
	async deleteDB() {
		this.#db.close();

		await deleteDB(this.#name);
	}

	/** @instance Closes the current database connection. */
	close() {
		this.#db.close();
	}

	/** @instance Gets the underlying `IDBDatabase` instance. */
	async getDBInstance(): Promise<IDBDatabase> {
		await this.#readyPromise;
		return this.#db;
	}

	/** @instance Get all table (store) names in the current database. */
	get tableList(): LooseLiteral<TName>[] {
		return Array.from(this.#db.objectStoreNames) as LooseLiteral<TName>[];
	}

	/** @instance Get the list of existing `IndexedDB` databases. */
	get dbList(): IDBDatabaseInfo[] {
		return Locality.getDatabaseList();
	}

	/**
	 * @instance Seed data into a specific table.
	 *
	 * @remarks
	 * - This is a convenience method that inserts multiple records into the specified table.
	 * - It does not clear existing data; it only adds new records.
	 *
	 * @param table Name of the table to seed data into.
	 * @param data Array of data objects to be inserted.
	 * @returns A promise that resolves to an array of inserted data.
	 *
	 * @example
	 * const db = new Locality({
	 * 	dbName: 'my-database',
	 * 	version: 1,
	 * 	schema: defineSchema({
	 * 		users: {
	 * 			id: column.int().pk().auto(),
	 * 			name: column.text(),
	 * 			email: column.varchar(255).unique(),
	 * 		},
	 * 	}),
	 * });
	 *
	 * await db.seed('users', [
	 *   { name: 'Alice', email: 'alice@wonderland.mad', },
	 *   { name: 'Bob', email: 'bob@top.com', },
	 * ]);
	 *
	 * const allUsers = await db.from('users').findAll();
	 *
	 * console.log(allUsers);
	 */
	async seed<
		T extends TName,
		Raw extends InferInsertType<Schema[T]>,
		Data extends InferSelectType<Schema[T]>,
	>(table: T, data: Raw[]): Promise<Data[]> {
		const insertQuery = new InsertQuery<Raw, Raw[], Data, Data[]>(
			table,
			() => this.#db,
			this.#readyPromise,
			this.#schema[table].columns,
			this.#keyPaths[table]
		);

		return await insertQuery.values(data).run();
	}

	/**
	 * @instance Execute multiple operations across multiple tables in a single atomic transaction.
	 *
	 * @remarks
	 * - All operations succeed or all fail (atomicity guaranteed by IndexedDB).
	 * - If any operation fails, the entire transaction is rolled back automatically.
	 * - Useful for maintaining data consistency across related tables.
	 *
	 * @param tables Array of table names to include in the transaction
	 * @param callback Async function that receives a transaction context and performs operations
	 * @returns A promise that resolves when the transaction completes successfully
	 *
	 * @throws Error if the transaction is aborted due to constraint violations or other errors
	 *
	 * @example
	 * const db = new Locality({
	 * 	dbName: 'my-database',
	 * 	version: 1,
	 * 	schema: defineSchema({
	 * 		users: {
	 * 			id: column.int().pk().auto(),
	 * 			name: column.text(),
	 * 		},
	 * 		posts: {
	 * 			id: column.int().pk().auto(),
	 * 			userId: column.int(),
	 * 			title: column.text(),
	 * 		},
	 * 	}),
	 * });
	 *
	 * // Create a user and their first post atomically
	 * await db.transaction(['users', 'posts'], async (ctx) => {
	 * 	const newUser = await ctx.insert('users').values({ name: 'John Doe' }).run();
	 * 	await ctx.insert('posts').values({ userId: newUser.id, title: 'Hello World' }).run();
	 * });
	 */
	async transaction<Tables extends TName[]>(
		tables: Tables,
		callback: TransactionCallback<Schema, TName, Tables>
	) {
		await this.#readyPromise;

		const transaction = this.#db.transaction(tables, 'readwrite');

		const txContext: TransactionContext<Schema, TName, Tables> = {
			from: (table) => {
				return new SelectQuery(table, () => this.#db, this.#readyPromise, transaction);
			},

			insert: (table) => {
				return new InsertQuery(
					table,
					() => this.#db,
					this.#readyPromise,
					this.#schema[table].columns,
					this.#keyPaths[table],
					transaction
				);
			},

			update: (table) => {
				return new UpdateQuery(
					table,
					() => this.#db,
					this.#readyPromise,
					this.#schema[table].columns,
					this.#keyPaths[table],
					transaction
				);
			},

			delete: (table) => {
				return new DeleteQuery(
					table,
					() => this.#db,
					this.#readyPromise,
					this.#extractTablePk(table),
					transaction
				);
			},
		};

		return new Promise<void>((resolve, reject) => {
			// Set up transaction event handlers FIRST
			transaction.oncomplete = () => resolve();
			transaction.onabort = () => _abortTransaction(transaction.error, reject);
			transaction.onerror = () => reject(transaction.error);

			// * Execute the callback and handle errors
			callback(txContext)
				.then(() => {
					// ! Callback completed successfully, transaction will auto-commit
				})
				.catch((error) => {
					// ! Callback threw an error - abort and reject immediately
					transaction.abort();
					reject(error);
				});
		});
	}

	/**
	 * @instance Export database data as JSON file and trigger browser download.
	 *
	 * @remarks
	 * - Exports all tables by default, or only specified tables if provided.
	 * - Generates a JSON file with schema metadata and table data.
	 * - Automatically triggers a download in the browser.
	 *
	 * @param options Export configuration options
	 * @returns A promise that resolves when the export completes
	 *
	 * @example
	 * const db = new Locality({
	 * 	dbName: 'my-database',
	 * 	version: 1,
	 * 	schema: defineSchema({
	 * 		users: {
	 * 			id: column.int().pk().auto(),
	 * 			name: column.text(),
	 * 		},
	 * 		posts: {
	 * 			id: column.int().pk().auto(),
	 * 			title: column.text(),
	 * 		},
	 * 	}),
	 * });
	 *
	 * // Export all tables pretty-printed pretty-printed with default filename
	 * await db.export();
	 *
	 * // Export specific tables pretty-printed with custom filename
	 * await db.export({ tables: ['users'], filename: 'users-backup.json' });
	 *
	 * // Export with raw JSON
	 * await db.export({ pretty: false });
	 */
	async export(options?: ExportOptions<TName>): Promise<void> {
		await this.#readyPromise;

		const { tables, filename, pretty = true, includeMetadata = true } = options || {};

		// Determine which tables to export
		const tablesToExport = tables || Object.keys(this.#schema);

		// Export data from all specified tables
		const exportData: Record<string, GenericObject[]> = {};

		for (const table of tablesToExport as TName[]) {
			const data = await this.from(table).findAll();
			exportData[table] = data;
		}

		// Build export object
		const exportObj = {} as ExportData;

		const ts = getTimestamp();

		if (includeMetadata) {
			exportObj.metadata = {
				dbName: this.#name,
				version: this.version,
				exportedAt: ts,
				tables: tablesToExport,
			};
		}

		exportObj.data = exportData;

		// Convert to JSON
		const jsonString = JSON.stringify(exportObj, null, pretty ? 2 : undefined);

		// Create blob
		const blob = new Blob([jsonString], { type: 'application/json' });

		// Create download link and trigger download
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);

		link.href = url;
		link.download = filename ?? `${this.#name}-${ts.replace(/[:.]/g, '-')}.json`;

		document.body.appendChild(link);

		link.click();

		// Clean up
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	/** @static Get the list of existing `IndexedDB` databases. */
	static getDatabaseList() {
		_ensureIndexedDB();

		return _getDBList();
	}

	/** @static Delete an `IndexedDB` database by name. */
	static async deleteDatabase(name: string): Promise<void> {
		await deleteDB(name);
	}
}
