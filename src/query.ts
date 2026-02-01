import { isNonEmptyString, isNotEmptyObject, sortAnArray } from 'nhb-toolbox';
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
	SelectFields,
	SortDirection,
} from './types';
import { validateAndPrepareData } from './validators';

/** Symbol for type extraction (exists only in type system) */
const Selected = Symbol('Selected');
/** Symbol to indicate if insert data is array */
const IsArray = Symbol('IsArray');

type IDBGetter = () => IDBDatabase;

/**
 * @class Select query builder.
 */
export class SelectQuery<
	T extends GenericObject,
	S extends Partial<Record<string, boolean>> | null = null,
	Tbl extends Table = Table,
> {
	#table: string;
	#readyPromise: Promise<void>;

	#dbGetter: IDBGetter;
	#whereCondition?: (row: T) => boolean;

	#orderByKey?: NestedPrimitiveKey<T>;
	#orderByDir: SortDirection = 'asc';
	#limitCount?: number;
	#useIndexCursor?: boolean;

	declare [Selected]?: S;

	constructor(table: string, dbGetter: IDBGetter, readyPromise: Promise<void>) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;
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
	where(predicate: (row: T) => boolean): this {
		this.#whereCondition = predicate;
		return this;
	}

	/**
	 * @instance  Order results by specified key and direction
	 * @param key Key to order by
	 * @param dir Direction: 'asc' | 'desc' (default: 'asc')
	 */
	orderBy<Key extends NestedPrimitiveKey<T>>(key: Key, dir: SortDirection = 'asc'): this {
		this.#orderByKey = key;
		this.#orderByDir = dir;

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

	/** Projects a row based on selected fields */
	#projectRow(row: T): Partial<T> {
		if (!isNotEmptyObject(this?.[Selected])) return row;

		type Key = keyof T;

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

	/** Fetch all matching records */
	async findAll(this: SelectQuery<T, null>): Promise<T[]>;

	/** Fetch all matching records with selected fields */
	async findAll<Selection extends Partial<Record<keyof T, boolean>>>(
		this: SelectQuery<T, Selection>
	): Promise<SelectFields<T, Selection>[]>;

	async findAll() {
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.#dbGetter().transaction(this.#table, 'readonly');
			const store = transaction.objectStore(this.#table);

			// Check if we can use an optimized index cursor
			const useIdxCursor =
				this.#useIndexCursor &&
				this.#orderByKey &&
				isNonEmptyString(this.#orderByKey) &&
				store.indexNames.contains(this.#orderByKey) &&
				!this.#whereCondition; // Only use cursor if no where condition

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
				const request = store.getAll();

				request.onsuccess = () => {
					let results: T[] = request.result;

					// Apply where filter
					if (this.#whereCondition) {
						results = results.filter(this.#whereCondition);
					}

					// Apply orderBy
					results = this.#sort(results);

					// Apply limit
					if (this.#limitCount) {
						results = results.slice(0, this.#limitCount);
					}

					// Apply projection (select)
					const projectedResults = results.map((row) => this.#projectRow(row));

					resolve(projectedResults);
				};

				request.onerror = () => reject(request.error);
			}
		});
	}

	/** Fetch first matching record */
	async first(this: SelectQuery<T, null>): Promise<T | null>;

	/** Fetch first matching record with selected fields */
	async first<Selection extends Partial<Record<keyof T, boolean>>>(
		this: SelectQuery<T, Selection>
	): Promise<SelectFields<T, Selection> | null>;

	async first() {
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.#dbGetter().transaction(this.#table, 'readonly');
			const store = transaction.objectStore(this.#table);
			const request = store.getAll();

			request.onsuccess = () => {
				let results: T[] = request.result;

				// Apply where filter
				if (this.#whereCondition) {
					results = results.filter(this.#whereCondition);
				}

				// Apply projection (select)
				if (results.length > 0) {
					resolve(this.#projectRow(results[0]));
				} else {
					resolve(null);
				}
			};

			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * @instance Find record by primary key (optimized `IndexedDB` get)
	 * @param key Primary key value
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
			const transaction = this.#dbGetter().transaction(this.#table, 'readonly');
			const store = transaction.objectStore(this.#table);
			const request = store.get(key);

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
	 * @instance Find records by index (optimized IndexedDB index query)
	 * @param indexName Name of the index to query
	 * @param query Key value to search for
	 */
	async findByIndex<IndexKey extends $InferIndex<Tbl['columns']> & keyof T & string>(
		indexName: IndexKey,
		query: T[IndexKey] | IDBKeyRange
	): Promise<
		S extends null ? T[]
		: S extends Partial<Record<keyof T, boolean>> ? SelectFields<T, S>[]
		: never
	> {
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.#dbGetter().transaction(this.#table, 'readonly');
			const store = transaction.objectStore(this.#table);

			// Check if index exists
			if (!store.indexNames.contains(indexName)) {
				reject(
					new Error(`Index "${indexName}" does not exist on table "${this.#table}"`)
				);
				return;
			}

			const index = store.index(indexName);
			const request = index.getAll(query);

			request.onsuccess = () => {
				let results: T[] = request.result;

				// Apply where filter
				if (this.#whereCondition) {
					results = results.filter(this.#whereCondition);
				}

				// Apply orderBy
				results = this.#sort(results);

				// Apply limit
				if (this.#limitCount) {
					results = results.slice(0, this.#limitCount);
				}

				// Apply projection
				const projectedResults = results.map((row) => this.#projectRow(row));
				resolve(
					projectedResults as S extends null ? T[]
					: S extends Partial<Record<keyof T, boolean>> ? SelectFields<T, S>[]
					: never
				);
			};

			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * @instance Order results by index using optimized IndexedDB cursor
	 * @param indexName Name of the index to sort by
	 * @param dir Direction: 'asc' | 'desc' (default: 'asc')
	 */
	sortByIndex<
		IndexKey extends ($InferIndex<Tbl['columns']> | $InferPrimaryKey<Tbl['columns']>) &
			keyof T &
			string,
	>(indexName: IndexKey, dir: SortDirection = 'asc'): this {
		this.#orderByKey = indexName as unknown as NestedPrimitiveKey<T>;
		this.#orderByDir = dir;
		this.#useIndexCursor = true;
		return this;
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

	declare [IsArray]: boolean;

	constructor(
		table: string,
		dbGetter: () => IDBDatabase,
		readyPromise: Promise<void>,
		columns?: ColumnDefinition,
		keyPath?: string
	) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;
		this.#columns = columns;
		this.#keyPath = keyPath;
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
		return new Promise((resolve, reject) => {
			const transaction = this.#dbGetter().transaction(this.#table, 'readwrite');
			const store = transaction.objectStore(this.#table);

			const insertedDocs: Data[] = [];

			const promises: Promise<void>[] = this.#dataToInsert.map((data) => {
				return new Promise((res, rej) => {
					const request = store.add(
						validateAndPrepareData(data, this.#columns, this.#keyPath, this.#table)
					);

					request.onsuccess = () => {
						const key = request.result;
						const getRequest = store.get(key);

						getRequest.onsuccess = () => {
							insertedDocs.push(getRequest.result);
							res();
						};

						getRequest.onerror = () => rej(getRequest.error);
					};
					request.onerror = () => rej(request.error);
				});
			});

			// Start handling promises immediately (don't wait for transaction events)
			Promise.all(promises).catch(reject);

			// Handle transaction completion (only fires if all succeeded)
			transaction.oncomplete = () => {
				resolve(
					this[IsArray] === true ?
						(insertedDocs as Return)
					:	(insertedDocs[0] as unknown as Return)
				);
			};

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

	constructor(
		table: string,
		dbGetter: () => IDBDatabase,
		readyPromise: Promise<void>,
		columns?: ColumnDefinition,
		keyPath?: string
	) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;
		this.#columns = columns;
		this.#keyPath = keyPath;
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
			const transaction = this.#dbGetter().transaction(this.#table, 'readwrite');
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
					.catch(reject);
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

	constructor(
		table: string,
		dbGetter: () => IDBDatabase,
		readyPromise: Promise<void>,
		keyField: Key
	) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;
		this.#keyField = keyField;
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
			const transaction = this.#dbGetter().transaction(this.#table, 'readwrite');
			const store = transaction.objectStore(this.#table);
			const request = store.getAll();

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
					.catch(reject);
			};

			request.onerror = () => reject(request.error);

			// Handle transaction abort (happens on errors)
			transaction.onabort = () => _abortTransaction(transaction.error, reject);
		});
	}
}
