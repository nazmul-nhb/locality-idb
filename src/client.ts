import { IsAutoInc, IsIndexed, IsPrimaryKey, IsUnique } from './core';
import { openDBWithStores } from './factory';
import { _abortTransaction, _ensureIndexedDB, _getDBList } from './helpers';
import { DeleteQuery, InsertQuery, SelectQuery, UpdateQuery } from './query';
import type {
	$InferRow,
	ExportData,
	ExportOptions,
	GenericObject,
	ImportOptions,
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
import { validateAndPrepareData } from './validators';

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

	get version(): Version {
		return (this.#db?.version ?? this.#version ?? this.#configVersion) as Version;
	}

	/** @instance Get all table (store) names in the current database. */
	get tableList(): LooseLiteral<TName>[] {
		return Array.from(this.#db.objectStoreNames) as LooseLiteral<TName>[];
	}

	/** @instance Get the list of existing `IndexedDB` databases. */
	get dbList(): Promise<IDBDatabaseInfo[]> {
		return Locality.getDatabaseList();
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
		return new DeleteQuery<Row, keyof Row, Schema[T]>(
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
		const { filename, pretty = true } = options || {};
		const exportObj = await this.exportToObject(options);
		const ts = exportObj.metadata?.exportedAt ?? getTimestamp();

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

	/**
	 * @instance Export database data as an object without triggering a download.
	 *
	 * @remarks
	 * - Exports all tables by default, or only specified tables if provided.
	 * - Returns a JSON-serializable object with schema metadata and table data.
	 */
	async exportToObject(options?: ExportOptions<TName>): Promise<ExportData> {
		await this.#readyPromise;

		const { tables, includeMetadata = true } = options || {};
		const tablesToExport = (tables ?? Object.keys(this.#schema)) as TName[];

		for (const table of tablesToExport) {
			if (!(table in this.#schema)) {
				throw new RangeError(`Table '${String(table)}' does not exist in schema.`);
			}
		}

		if (tablesToExport.length === 0) {
			return {
				metadata:
					includeMetadata ?
						{
							dbName: this.#name,
							version: this.version,
							exportedAt: getTimestamp(),
							tables: [],
						}
					:	undefined,
				data: {},
			};
		}

		const exportData: Record<string, GenericObject[]> = {};
		const transaction = this.#db.transaction(tablesToExport as string[], 'readonly');

		return new Promise((resolve, reject) => {
			transaction.onabort = () => _abortTransaction(transaction.error, reject);
			transaction.onerror = () => reject(transaction.error);

			const readPromises = tablesToExport.map(
				(table) =>
					new Promise<void>((res, rej) => {
						const store = transaction.objectStore(table as string);
						const request = store.getAll() as IDBRequest<GenericObject[]>;

						request.onsuccess = () => {
							exportData[table as string] = request.result;
							res();
						};

						request.onerror = () => rej(request.error);
					})
			);

			Promise.all(readPromises)
				.then(() => {
					const exportObj = {} as ExportData;
					const ts = getTimestamp();

					if (includeMetadata) {
						exportObj.metadata = {
							dbName: this.#name,
							version: this.version,
							exportedAt: ts,
							tables: tablesToExport as string[],
						};
					}

					exportObj.data = exportData;
					resolve(exportObj);
				})
				.catch(reject);
		});
	}

	/**
	 * @instance Import data into the database.
	 *
	 * @remarks
	 * - Accepts either raw table data or an {@link ExportData} object.
	 * - Supports merge, replace, and upsert modes.
	 */
	async import(
		data: ExportData | Record<string, GenericObject[]>,
		options?: ImportOptions<TName>
	) {
		await this.#readyPromise;

		const { mode = 'merge', tables } = options || {};
		const dataMap = ('data' in data ? data.data : data) as Record<string, GenericObject[]>;
		const tablesToImport = (tables ?? Object.keys(dataMap)) as TName[];

		for (const table of tablesToImport) {
			if (!(table in this.#schema)) {
				throw new RangeError(`Table '${String(table)}' does not exist in schema.`);
			}
		}

		if (tablesToImport.length === 0) return;

		const transaction = this.#db.transaction(tablesToImport as string[], 'readwrite');

		return new Promise<void>((resolve, reject) => {
			transaction.onabort = () => _abortTransaction(transaction.error, reject);
			transaction.onerror = () => reject(transaction.error);

			const tablePromises = tablesToImport.map(async (table) => {
				const store = transaction.objectStore(table);
				const rows = (dataMap[table] ?? []) as GenericObject[];

				if (mode === 'replace') {
					await new Promise<void>((res, rej) => {
						const clearRequest = store.clear();
						clearRequest.onsuccess = () => res();
						clearRequest.onerror = () => rej(clearRequest.error);
					});
				}

				if (rows.length === 0) return;

				const writePromises = rows.map((row) => {
					return new Promise<void>((res, rej) => {
						const prepared = validateAndPrepareData(
							row,
							this.#schema[table].columns,
							this.#keyPaths[table],
							String(table)
						);

						const request =
							mode === 'upsert' ? store.put(prepared) : store.add(prepared);

						request.onsuccess = () => res();
						request.onerror = () => rej(request.error);
					});
				});

				await Promise.all(writePromises);
			});

			Promise.all(tablePromises)
				.then(() => resolve())
				.catch((err) => {
					transaction.abort();
					reject(err);
				});
		});
	}

	/** @instance Clear all records from all tables. */
	async clearAll() {
		await this.#readyPromise;

		const tables = Object.keys(this.#schema) as TName[];
		if (tables.length === 0) return;

		const transaction = this.#db.transaction(tables as string[], 'readwrite');

		return new Promise<void>((resolve, reject) => {
			transaction.onabort = () => _abortTransaction(transaction.error, reject);
			transaction.onerror = () => reject(transaction.error);

			const clearPromises = tables.map(
				(table) =>
					new Promise<void>((res, rej) => {
						const store = transaction.objectStore(table as string);
						const request = store.clear();
						request.onsuccess = () => res();
						request.onerror = () => rej(request.error);
					})
			);

			Promise.all(clearPromises)
				.then(() => resolve())
				.catch((err) => {
					transaction.abort();
					reject(err);
				});
		});
	}

	/**
	 * @instance Drop a table (object store) by name.
	 *
	 * @remarks
	 * - This increments the database version internally.
	 * - You should re-instantiate `Locality` with an updated schema after dropping.
	 */
	async dropTable<T extends TName>(table: T) {
		await this.#readyPromise;

		if (!(table in this.#schema)) {
			throw new RangeError(`Table '${String(table)}' does not exist in schema.`);
		}

		const nextStores = this.#buildStoresConfig().filter((store) => store.name !== table);
		const nextVersion = (this.version + 1) as Version;

		this.#db.close();

		this.#readyPromise = openDBWithStores(this.#name, nextStores, nextVersion)
			.then((db) => {
				this.#db = db;
				const keyPaths = this.#keyPaths as Record<string, Maybe<string>>;
				delete keyPaths[String(table)];
			})
			.finally(() => {
				this.#version = this.#db?.version as Version;
			});

		await this.#readyPromise;
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
