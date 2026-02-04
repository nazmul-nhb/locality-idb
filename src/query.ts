import {
	isFunction,
	isNonEmptyString,
	isNotEmptyObject,
	isUndefined,
	sortAnArray,
} from 'nhb-toolbox';
import { type Table } from './core';
import { _abortTransaction } from './helpers';
import type {
	$InferIndex,
	$InferPrimaryKey,
	ColumnDefinition,
	FirstOverloadParams,
	GenericObject,
	InferUpdateType,
	Maybe,
	NestedPrimitiveKey,
	RejectFn,
	SelectFields,
	SortDirection,
	WherePredicate,
} from './types';
import { validateAndPrepareData } from './validators';

/** Symbol for type extraction (exists only in type system) */
const Selected = Symbol('Selected');
/** Symbol to indicate if insert data is array */
const IsArray = Symbol('IsArray');

type IDBGetter = () => IDBDatabase;

/** @class Select query builder. */
export class SelectQuery<
	T extends GenericObject,
	S extends Partial<Record<string, boolean>> | null = null,
	Tbl extends Table = Table,
> {
	#table: string;
	#readyPromise: Promise<void>;

	#dbGetter: IDBGetter;
	#whereCondition?: WherePredicate<T>;
	#whereIndexName?: string;
	#whereIndexQuery?: IDBKeyRange;

	#orderByKey?: NestedPrimitiveKey<T>;
	#orderByDir: SortDirection = 'asc';
	#limitCount?: number;
	#useIndexCursor?: boolean;

	#transaction?: IDBTransaction;

	declare [Selected]?: S;

	constructor(
		table: string,
		dbGetter: IDBGetter,
		readyPromise: Promise<void>,
		transaction?: IDBTransaction
	) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;

		this.#transaction = transaction;
	}

	/** @internal Create a readonly transaction and return the store */
	#getStore(): { transaction: IDBTransaction; store: IDBObjectStore } {
		const transaction =
			this.#transaction ?? this.#dbGetter().transaction(this.#table, 'readonly');
		const store = transaction.objectStore(this.#table);
		return { transaction, store };
	}

	/** @internal Check if key is an index on the store for the `#whereIndexName` */
	#isIndexKey(store: IDBObjectStore): boolean {
		return (
			isNonEmptyString(this.#whereIndexName) &&
			store.indexNames.contains(this.#whereIndexName)
		);
	}

	/** @internal Check if key is the primary key on the store for the `#whereIndexName` */
	#isPrimaryKey(store: IDBObjectStore): boolean {
		return isNonEmptyString(this.#whereIndexName) && store.keyPath === this.#whereIndexName;
	}

	/** @internal Build indexed store (primary key or index) for where queries */
	#buildIndexedStore(store: IDBObjectStore, reject: RejectFn) {
		const isPK = this.#isPrimaryKey(store);
		const isIndex = this.#isIndexKey(store);

		if (!isPK && !isIndex) {
			reject(
				new RangeError(
					`Index '${this.#whereIndexName}' does not exist on table '${this.#table}'`
				)
			);

			return null;
		}

		// Primary keys use store directly, indexes use store.index()
		return isPK ? store : store.index(this.#whereIndexName as string);
	}

	/** @internal Sort data in memory if needed */
	#sort(data: T[]): T[] {
		if (this.#orderByKey) {
			return sortAnArray(data, {
				sortOrder: this.#orderByDir,
				sortByField: this.#orderByKey as FirstOverloadParams<
					typeof sortAnArray
				>[1]['sortByField'],
			});
		}

		return data;
	}

	/** @internal Apply sort, limit, and projection pipeline to results */
	#applyPipeline(results: T[]): Partial<T>[] {
		// Apply orderBy
		let processed = this.#sort(results);

		// Apply limit
		if (this.#limitCount) {
			processed = processed.slice(0, this.#limitCount);
		}

		// Apply projection (select)
		return processed.map((row) => this.#projectRow(row));
	}

	/** Projects a row based on selected fields */
	#projectRow(row: T): Partial<T> {
		type Key = keyof T;

		if (!isNotEmptyObject(this?.[Selected])) return row;

		const projected = {} as Partial<T>;

		const selectionEntries = Object.entries(this[Selected]);
		const selectionKeys = new Set(Object.keys(this[Selected]));

		// Check if any value is true
		const hasTrueValues = selectionEntries.some(([, value]) => value === true);

		if (hasTrueValues) {
			// Include only fields marked as true
			for (const [key, value] of selectionEntries) {
				if (value === true) {
					projected[key as Key] = row[key];
				}
			}
		} else {
			// All are false: include all fields EXCEPT those marked as false
			for (const key of Object.keys(row)) {
				if (!selectionKeys.has(key) || this[Selected][key] !== false) {
					projected[key as Key] = row[key];
				}
			}
		}

		return projected;
	}

	/**
	 * @instance Select or exclude specific columns
	 * @param cols Columns to select or exclude
	 */
	select<Selection extends Partial<Record<keyof T, boolean>>>(cols: Selection) {
		this[Selected] = cols as unknown as S;

		return this as unknown as SelectQuery<T, Selection, Tbl>;
	}

	/**
	 * @instance  Filter rows based on predicate function
	 * @param predicate Filtering function
	 */
	where(predicate: WherePredicate<T>): this;

	/**
	 * @instance  Filter rows based on index query
	 * @param indexName Name of the index/primary key to query
	 * @param query Key value or {@link IDBKeyRange} to search for
	 */
	where<IdxKey extends $InferPrimaryKey<Tbl['columns']> | $InferIndex<Tbl['columns']>>(
		indexName: IdxKey,
		query: IDBKeyRange | T[IdxKey]
	): this;

	where<IdxKey extends $InferPrimaryKey<Tbl['columns']> | $InferIndex<Tbl['columns']>>(
		condition: WherePredicate<T> | IdxKey,
		query?: IDBKeyRange | T[IdxKey]
	): this {
		if (isFunction(condition)) {
			this.#whereCondition = condition;
			this.#whereIndexName = undefined;
			this.#whereIndexQuery = undefined;
		} else if (isNonEmptyString(condition) && !isUndefined(query)) {
			this.#whereIndexName = condition;
			this.#whereIndexQuery = query;
			this.#whereCondition = undefined;
		}

		return this;
	}

	/**
	 * @instance  Order results by specified key and direction
	 * @param key Key to order by
	 * @param dir Direction: 'asc' | 'desc' (default: 'asc')
	 *
	 * @remarks
	 * - This method performs in-memory sorting.
	 * - For optimized sorting using `IndexedDB` indexes, use {@link sortByIndex} instead.
	 */
	orderBy<Key extends NestedPrimitiveKey<T>>(key: Key, dir: SortDirection = 'asc'): this {
		this.#orderByKey = key;
		this.#orderByDir = dir;

		return this;
	}

	/**
	 * @instance Order results by index using optimized `IndexedDB` cursor
	 * @param indexName Name of the index to sort by
	 * @param dir Direction: 'asc' | 'desc' (default: 'asc')
	 *
	 * @remarks
	 * - This method uses `IndexedDB` indexes for sorting, which is more efficient for large datasets.
	 * - Ensure that the specified index exists on the table.
	 * - For in-memory sorting, use {@link orderBy} instead.
	 */
	sortByIndex<IdxKey extends $InferIndex<Tbl['columns']> | $InferPrimaryKey<Tbl['columns']>>(
		indexName: IdxKey,
		dir: SortDirection = 'asc'
	): this {
		this.#orderByKey = indexName as unknown as NestedPrimitiveKey<T>;
		this.#orderByDir = dir;
		this.#useIndexCursor = true;

		return this;
	}

	/**
	 * @instance Limit number of results
	 * @param count Maximum number of results to return
	 */
	limit(count: number): this {
		this.#limitCount = count;
		return this;
	}

	/** Fetch all matching records */
	async findAll(this: SelectQuery<T, null>): Promise<T[]>;

	/** Fetch all matching records with selected fields */
	async findAll<Selection extends Partial<Record<keyof T, boolean>>>(
		this: SelectQuery<T, Selection>
	): Promise<SelectFields<T, Selection>[]>;

	async findAll() {
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();

			// If we have an index-based where query, use it
			if (this.#whereIndexName && !isUndefined(this.#whereIndexQuery)) {
				const source = this.#buildIndexedStore(store, reject);

				if (!source) return;

				const request = source.getAll(this.#whereIndexQuery) as IDBRequest<T[]>;

				request.onsuccess = () => {
					resolve(this.#applyPipeline(request.result));
				};

				request.onerror = () => reject(request.error);

				return;
			}

			// Check if we can use an optimized index cursor
			const useIdxCursor =
				this.#useIndexCursor &&
				this.#orderByKey &&
				isNonEmptyString(this.#orderByKey) &&
				store.indexNames.contains(this.#orderByKey) &&
				!this.#whereCondition; // Only use cursor if no predicate where condition

			if (useIdxCursor) {
				// Use optimized index cursor
				const index = store.index(this.#orderByKey as string);
				const direction = this.#orderByDir === 'desc' ? 'prev' : 'next';
				const request = index.openCursor(null, direction);
				const results: T[] = [];

				let count = 0;

				request.onsuccess = () => {
					const cursor = request.result;

					if (cursor) {
						results.push(cursor.value);
						count++;

						// Stop if we've reached the limit
						if (this.#limitCount && count >= this.#limitCount) {
							resolve(results.map((row) => this.#projectRow(row)));
							return;
						}

						cursor.continue();
					} else {
						// No more results
						resolve(results.map((row) => this.#projectRow(row)));
					}
				};

				request.onerror = () => reject(request.error);
			} else {
				// Use standard getAll with in-memory sorting
				const request = store.getAll() as IDBRequest<T[]>;

				request.onsuccess = () => {
					let results = request.result;

					// Apply where filter
					if (this.#whereCondition) {
						results = results.filter(this.#whereCondition);
					}

					resolve(this.#applyPipeline(results));
				};

				request.onerror = () => reject(request.error);
			}
		});
	}

	/** Fetch first matching record */
	async findFirst(this: SelectQuery<T, null>): Promise<T | null>;

	/** Fetch first matching record with selected fields */
	async findFirst<Selection extends Partial<Record<keyof T, boolean>>>(
		this: SelectQuery<T, Selection>
	): Promise<SelectFields<T, Selection> | null>;

	async findFirst() {
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();

			// If we have an index-based where query, use it
			if (this.#whereIndexName && !isUndefined(this.#whereIndexQuery)) {
				const source = this.#buildIndexedStore(store, reject);

				if (!source) return;

				const request = source.getAll(this.#whereIndexQuery) as IDBRequest<T[]>;

				request.onsuccess = () => {
					const results = this.#applyPipeline(request.result);
					resolve(results.length > 0 ? results[0] : null);
				};

				request.onerror = () => reject(request.error);
				return;
			}

			const request = store.getAll() as IDBRequest<T[]>;

			request.onsuccess = () => {
				let results = request.result;

				// Apply where filter
				if (this.#whereCondition) {
					results = results.filter(this.#whereCondition);
				}

				const processed = this.#applyPipeline(results);
				resolve(processed.length > 0 ? processed[0] : null);
			};

			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * @instance Find record by primary key (optimized `IndexedDB` get)
	 * @param key Primary key value
	 *
	 * @remarks
	 * - This method uses the `IndexedDB` primary key for efficient querying.
	 * - Ensure that the specified key exists on the table.
	 * - To find by index, use {@link findByIndex} instead.
	 */
	async findByPk(
		key: $InferPrimaryKey<Tbl['columns']> extends keyof T ?
			T[$InferPrimaryKey<Tbl['columns']>]
		:	T[keyof T]
	): Promise<
		S extends null ? T | null
		: S extends Partial<Record<keyof T, boolean>> ? SelectFields<T, S> | null
		: never
	> {
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();
			const request = store.get(key) as IDBRequest<T>;

			type ResolvedData =
				S extends null ? T | null
				: S extends Partial<Record<keyof T, boolean>> ? SelectFields<T, S> | null
				: never;

			request.onsuccess = () => {
				const result = request.result as Maybe<T>;

				if (!result) {
					resolve(null as ResolvedData);
					return;
				}

				// Apply where filter if specified
				if (this.#whereCondition && !this.#whereCondition(result)) {
					resolve(null as ResolvedData);
					return;
				}

				// Apply projection
				resolve(this.#projectRow(result) as ResolvedData);
			};

			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * @instance Find records by index (optimized `IndexedDB` index query)
	 * @param indexName Name of the index to query
	 * @param query Key value to search for
	 *
	 * @remarks
	 * - This method uses `IndexedDB` indexes for efficient querying.
	 * - Ensure that the specified index exists on the table.
	 * - To find by primary key, use {@link findByPk} instead.
	 */
	async findByIndex<IdxKey extends $InferIndex<Tbl['columns']> & keyof T & string>(
		indexName: IdxKey,
		query: T[IdxKey] | IDBKeyRange
	): Promise<
		S extends null ? T[]
		: S extends Partial<Record<keyof T, boolean>> ? SelectFields<T, S>[]
		: never
	> {
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();

			// Check if index exists
			if (!store.indexNames.contains(indexName)) {
				reject(
					new RangeError(
						`Index '${indexName}' does not exist on table '${this.#table}'`
					)
				);
				return;
			}

			const index = store.index(indexName);
			const request = index.getAll(query) as IDBRequest<T[]>;

			request.onsuccess = () => {
				let results = request.result;

				// Apply where filter
				if (this.#whereCondition) {
					results = results.filter(this.#whereCondition);
				}

				resolve(
					this.#applyPipeline(results) as S extends null ? T[]
					: S extends Partial<Record<keyof T, boolean>> ? SelectFields<T, S>[]
					: never
				);
			};

			request.onerror = () => reject(request.error);
		});
	}

	/** @instance Count matching records */
	async count(): Promise<number> {
		await this.#readyPromise;

		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();

			// If we have an index-based where query, use it
			if (this.#whereIndexName && !isUndefined(this.#whereIndexQuery)) {
				const source = this.#buildIndexedStore(store, reject);

				if (!source) return;

				const request = source.count(this.#whereIndexQuery);

				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
				return;
			}

			// If we have a predicate-based where condition, we need to get all and filter
			if (this.#whereCondition) {
				const request = store.getAll() as IDBRequest<T[]>;

				request.onsuccess = () => {
					const filtered = request.result.filter(this.#whereCondition!);
					resolve(filtered.length);
				};

				request.onerror = () => reject(request.error);
				return;
			}

			// No where conditions, use optimized count
			const request = store.count();

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	async exists(): Promise<boolean> {
		const count = await this.count();

		return count > 0;
	}
}

/** @class Insert query builder. */
export class InsertQuery<
	Raw extends GenericObject,
	Inserted extends Raw | Raw[],
	Data extends GenericObject,
	Return extends Inserted extends Array<infer _> ? Data[] : Data,
> {
	#table: string;
	#dbGetter: () => IDBDatabase;
	#readyPromise: Promise<void>;
	#dataToInsert: Raw[] = [];
	#columns?: ColumnDefinition;
	// TODO: Handle multiple primary keys later
	#keyPath?: string;

	#transaction?: IDBTransaction;

	declare [IsArray]: boolean;

	constructor(
		table: string,
		dbGetter: () => IDBDatabase,
		readyPromise: Promise<void>,
		columns?: ColumnDefinition,
		keyPath?: string,
		transaction?: IDBTransaction
	) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;
		this.#columns = columns;
		this.#keyPath = keyPath;

		this.#transaction = transaction;
	}

	/**
	 * @instance Sets the data to be inserted
	 * @param data Data object or array of data objects to insert
	 */
	values<T extends Inserted>(data: T) {
		this[IsArray] = Array.isArray(data);

		this.#dataToInsert = (this[IsArray] ? data : [data]) as Raw[];

		return this as InsertQuery<Raw, T, Data, T extends Array<infer _> ? Data[] : Data>;
	}

	/**
	 * @instance Executes the insert query
	 * @returns Inserted record(s)
	 */
	async run(): Promise<Return> {
		await this.#readyPromise;

		const toBeInserted = this.#dataToInsert;

		if (toBeInserted.length === 0) {
			return (this[IsArray] ? [] : {}) as Return;
		}

		return new Promise((resolve, reject) => {
			const transaction =
				this.#transaction ?? this.#dbGetter().transaction(this.#table, 'readwrite');
			const store = transaction.objectStore(this.#table);

			const insertedDocs: Data[] = [];
			const insertedKeys: IDBValidKey[] = [];
			let insertCompleted = 0;

			// Start all insert operations
			for (const data of toBeInserted) {
				const request = store.add(
					validateAndPrepareData(data, this.#columns, this.#keyPath, this.#table)
				);

				request.onsuccess = () => {
					insertedKeys.push(request.result);
					insertCompleted++;

					// When all inserts complete, read the data back
					if (insertCompleted === toBeInserted.length) {
						if (this.#transaction) {
							// In transaction context: read from same transaction
							let readCompleted = 0;

							for (const key of insertedKeys) {
								const getRequest = store.get(key) as IDBRequest<Data>;

								getRequest.onsuccess = () => {
									insertedDocs.push(getRequest.result);
									readCompleted++;

									if (readCompleted === insertedKeys.length) {
										resolve(
											(this[IsArray] ? insertedDocs : (
												insertedDocs[0]
											)) as Return
										);
									}
								};

								getRequest.onerror = () => reject(getRequest.error);
							}
						}
						// If not in transaction context, oncomplete handler will read the data
					}
				};

				request.onerror = () => reject(request.error);
			}

			// If not in a transaction context, wait for transaction to complete and then read
			if (!this.#transaction) {
				transaction.oncomplete = () => {
					// Retrieve all inserted documents after successful transaction
					const readTx = this.#dbGetter().transaction(this.#table, 'readonly');
					const readStore = readTx.objectStore(this.#table);

					let completed = 0;

					for (const key of insertedKeys) {
						const getRequest = readStore.get(key) as IDBRequest<Data>;

						getRequest.onsuccess = () => {
							insertedDocs.push(getRequest.result);
							completed++;

							if (completed === insertedKeys.length) {
								resolve(
									(this[IsArray] ? insertedDocs : insertedDocs[0]) as Return
								);
							}
						};

						getRequest.onerror = () => reject(getRequest.error);
					}
				};
			}

			// Handle transaction abort (happens on errors like unique constraint violations)
			transaction.onabort = () => _abortTransaction(transaction.error, reject);

			transaction.onerror = () => reject(transaction.error);
		});
	}
}

/** @class Update query builder. */
export class UpdateQuery<T extends GenericObject, S extends Table> {
	#table: string;
	#dbGetter: () => IDBDatabase;
	#readyPromise: Promise<void>;
	#dataToUpdate?: InferUpdateType<S>;
	#whereCondition?: (row: T) => boolean;
	#columns?: ColumnDefinition;
	// TODO: Handle multiple primary keys later
	#keyPath?: string;

	#transaction?: IDBTransaction;

	constructor(
		table: string,
		dbGetter: () => IDBDatabase,
		readyPromise: Promise<void>,
		columns?: ColumnDefinition,
		keyPath?: string,
		transaction?: IDBTransaction
	) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;
		this.#columns = columns;
		this.#keyPath = keyPath;
		this.#transaction = transaction;
	}

	/**
	 * @instance Sets the data to be updated
	 * @param values Values to update
	 */
	set(values: InferUpdateType<S>) {
		this.#dataToUpdate = values;
		return this;
	}

	/**
	 * @instance Filter rows to update
	 * @param predicate Filtering function
	 */
	where(predicate: (row: T) => boolean) {
		this.#whereCondition = predicate;
		return this;
	}

	/**
	 * @instance Executes the update query
	 * @returns Number of records updated
	 */
	async run(): Promise<number> {
		await this.#readyPromise;

		if (!isNotEmptyObject(this.#dataToUpdate)) {
			throw new Error('No values set for update!');
		}

		return new Promise((resolve, reject) => {
			const transaction =
				this.#transaction ?? this.#dbGetter().transaction(this.#table, 'readwrite');
			const store = transaction.objectStore(this.#table);
			const request = store.getAll() as IDBRequest<T[]>;

			let updateCount = 0;

			request.onsuccess = () => {
				let rows = request.result;

				if (this.#whereCondition) {
					rows = rows.filter(this.#whereCondition);
				}

				const updatePromises = rows.map((row) => {
					return new Promise<void>((res, rej) => {
						const updatedRow = validateAndPrepareData<T>(
							{ ...row, ...this.#dataToUpdate },
							this.#columns,
							this.#keyPath,
							this.#table,
							true
						);

						const putRequest = store.put(updatedRow);

						putRequest.onsuccess = () => {
							updateCount++;
							res();
						};

						putRequest.onerror = () => rej(putRequest.error);
					});
				});

				Promise.all(updatePromises)
					.then(() => resolve(updateCount))
					.catch((err) => reject(err));
			};

			request.onerror = () => reject(request.error);

			// Handle transaction abort (happens on errors)
			transaction.onabort = () => _abortTransaction(transaction.error, reject);
		});
	}
}

/** @class Delete query builder. */
export class DeleteQuery<T extends GenericObject, Key extends keyof T> {
	#table: string;
	#dbGetter: () => IDBDatabase;
	#readyPromise: Promise<void>;
	#keyField: Key;
	#whereCondition?: (row: T) => boolean;

	#transaction?: IDBTransaction;

	constructor(
		table: string,
		dbGetter: () => IDBDatabase,
		readyPromise: Promise<void>,
		keyField: Key,
		transaction?: IDBTransaction
	) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;
		this.#keyField = keyField;
		this.#transaction = transaction;
	}

	/**
	 * @instance Filter rows to delete
	 * @param predicate Filtering function
	 */
	where(predicate: (row: T) => boolean) {
		this.#whereCondition = predicate;
		return this;
	}

	/**
	 * @instance Executes the delete query
	 * @returns Number of records deleted
	 */
	async run(): Promise<number> {
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const transaction =
				this.#transaction ?? this.#dbGetter().transaction(this.#table, 'readwrite');
			const store = transaction.objectStore(this.#table);
			const request = store.getAll() as IDBRequest<T[]>;

			let deleteCount = 0;

			request.onsuccess = () => {
				let rows: T[] = request.result;

				if (this.#whereCondition) {
					rows = rows.filter(this.#whereCondition);
				}

				const deletePromises = rows.map((row) => {
					return new Promise<void>((res, rej) => {
						const key = row[this.#keyField];
						const delRequest = store.delete(key);

						delRequest.onsuccess = () => {
							deleteCount++;
							res();
						};

						delRequest.onerror = () => rej(delRequest.error);
					});
				});

				Promise.all(deletePromises)
					.then(() => resolve(deleteCount))
					.catch((err) => reject(err));
			};

			request.onerror = () => reject(request.error);

			// Handle transaction abort (happens on errors)
			transaction.onabort = () => _abortTransaction(transaction.error, reject);
		});
	}
}
