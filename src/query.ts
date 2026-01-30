import { isNotEmptyObject, sortAnArray } from 'nhb-toolbox';
import { type Table } from './core';
import type {
	ColumnDefinition,
	FirstOverloadParams,
	GenericObject,
	InferUpdateType,
	NestedPrimitiveKey,
	SelectFields,
	SortDirection,
} from './types';
import { validateAndPrepareData } from './validators';

/** Symbol for type extraction (exists only in type system) */
const Selected = Symbol('Selected');
/** Symbol to indicate if insert data is array */
const IsArray = Symbol('IsArray');

/**
 * @class Select query builder.
 */
export class SelectQuery<T extends GenericObject, S = null> {
	#table: string;
	#readyPromise: Promise<void>;
	#dbGetter: () => IDBDatabase;
	#whereCondition?: (row: T) => boolean;
	#orderByKey?: NestedPrimitiveKey<T>;
	#orderByDir: SortDirection = 'asc';
	#limitCount?: number;
	declare [Selected]?: S;

	constructor(table: string, dbGetter: () => IDBDatabase, readyPromise: Promise<void>) {
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

		return this as unknown as SelectQuery<T, Selection>;
	}

	/**
	 * @instance  Filter rows based on predicate function
	 * @param predicate Filtering function
	 */
	where(predicate: (row: T) => boolean) {
		this.#whereCondition = predicate;
		return this;
	}

	/**
	 * @instance  Order results by specified key and direction
	 * @param key Key to order by
	 * @param dir Direction: 'asc' | 'desc' (default: 'asc')
	 */
	orderBy<Key extends NestedPrimitiveKey<T>>(key: Key, dir: SortDirection = 'asc') {
		this.#orderByKey = key;
		this.#orderByDir = dir;

		return this;
	}

	/**
	 * @instance Limit number of results
	 * @param count Maximum number of results to return
	 */
	limit(count: number) {
		this.#limitCount = count;
		return this;
	}

	/** Projects a row based on selected fields */
	#projectRow(row: T): Partial<T> {
		if (!isNotEmptyObject(this[Selected])) {
			return row;
		}

		const projected = {} as Partial<T>;
		const selectionEntries = Object.entries(this[Selected]);
		const selectionKeys = new Set(Object.keys(this[Selected]));

		// Check if any value is true
		const hasTrueValues = selectionEntries.some(([, value]) => value === true);

		if (hasTrueValues) {
			// Include only fields marked as true
			for (const [key, value] of selectionEntries) {
				if (value === true) {
					projected[key as keyof T] = row[key as keyof T];
				}
			}
		} else {
			// All are false: include all fields EXCEPT those marked as false
			for (const key of Object.keys(row)) {
				if (!selectionKeys.has(key) || this[Selected][key] !== false) {
					projected[key as keyof T] = row[key as keyof T];
				}
			}
		}

		return projected;
	}

	/** Fetch all matching records */
	async all(this: SelectQuery<T, null>): Promise<T[]>;

	/** Fetch all matching records with selected fields */
	async all<Selection extends Partial<Record<keyof T, boolean>>>(
		this: SelectQuery<T, Selection>
	): Promise<SelectFields<T, Selection>[]>;

	async all() {
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

				// Apply orderBy
				if (this.#orderByKey) {
					results = sortAnArray(results, {
						sortOrder: this.#orderByDir,
						sortByField: this.#orderByKey as FirstOverloadParams<
							typeof sortAnArray
						>[1]['sortByField'],
					});
				}

				// Apply limit
				if (this.#limitCount) {
					results = results.slice(0, this.#limitCount);
				}

				// Apply projection (select)
				const projectedResults = results.map((row) => this.#projectRow(row));

				resolve(projectedResults);
			};

			request.onerror = () => reject(request.error);
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
}

/** @class Insert query builder. */
export class InsertQuery<
	Raw extends GenericObject,
	Inserted,
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
						validateAndPrepareData(data, this.#columns, this.#keyPath)
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

			transaction.oncomplete = () =>
				Promise.all(promises)
					.then(() =>
						this[IsArray] === true ?
							resolve(insertedDocs as Return)
						:	resolve(insertedDocs[0] as unknown as Return)
					)
					.catch(reject);
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
		});
	}
}
