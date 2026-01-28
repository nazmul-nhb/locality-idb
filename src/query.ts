import { isNotEmptyObject, sortAnArray } from 'nhb-toolbox';
import { ColumnType, DefaultValue, type Table } from './core';
import type {
	ColumnDefinition,
	GenericObject,
	InferUpdateType,
	NestedPrimitiveKey,
	SelectFields,
	SortDirection,
} from './types';
import { getTimestamp, uuidV4 } from './utils';

const Selection = Symbol('Selection');
const IsArray = Symbol('IsArray');

/**
 * Select query builder.
 */
export class SelectQuery<T extends GenericObject, S = null> {
	#table: string;
	#readyPromise: Promise<void>;
	#dbGetter: () => IDBDatabase;
	#whereCondition?: (row: T) => boolean;
	#orderByKey?: NestedPrimitiveKey<T>;
	#orderByDir: SortDirection = 'asc';
	#limitCount?: number;
	declare [Selection]?: S;

	constructor(table: string, dbGetter: () => IDBDatabase, readyPromise: Promise<void>) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;
	}

	select<Selection extends Partial<Record<keyof T, boolean>>>(cols: Selection) {
		this[Selection] = cols as unknown as S;
		return this as unknown as SelectQuery<T, Selection>;
	}

	where(predicate: (row: T) => boolean) {
		this.#whereCondition = predicate;
		return this;
	}

	orderBy<Key extends NestedPrimitiveKey<T>>(key: Key, dir: SortDirection = 'asc') {
		this.#orderByKey = key;
		this.#orderByDir = dir;
		return this;
	}

	limit(count: number) {
		this.#limitCount = count;
		return this;
	}

	#projectRow(row: T): Partial<T> {
		if (!isNotEmptyObject(this[Selection])) {
			return row;
		}

		const projected = {} as Partial<T>;
		const selectionEntries = Object.entries(this[Selection]);
		const selectionKeys = new Set(Object.keys(this[Selection]));

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
				if (!selectionKeys.has(key) || this[Selection][key] !== false) {
					projected[key as keyof T] = row[key as keyof T];
				}
			}
		}

		return projected;
	}

	async all(this: SelectQuery<T, null>): Promise<T[]>;
	async all<Selection extends Partial<Record<keyof T, boolean>>>(
		this: SelectQuery<T, Selection>
	): Promise<SelectFields<T, Selection>[]>;

	async all(): Promise<any[]> {
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
						sortByField: this.#orderByKey as any,
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

	async first(this: SelectQuery<T, null>): Promise<T | null>;
	async first<Selection extends Partial<Record<keyof T, boolean>>>(
		this: SelectQuery<T, Selection>
	): Promise<SelectFields<T, Selection> | null>;

	async first(): Promise<any | null> {
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

/**
 * Insert query builder.
 */
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

	declare [IsArray]: boolean;

	constructor(
		table: string,
		dbGetter: () => IDBDatabase,
		readyPromise: Promise<void>,
		columns?: ColumnDefinition
	) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;
		this.#columns = columns;
	}

	values<T extends Inserted>(data: T) {
		this.#dataToInsert = (Array.isArray(data) ? data : [data]) as Raw[];
		this[IsArray] = Array.isArray(data);

		return this as InsertQuery<Raw, T, Data, T extends Array<infer _> ? Data[] : Data>;
	}

	async run(): Promise<Return> {
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.#dbGetter().transaction(this.#table, 'readwrite');
			const store = transaction.objectStore(this.#table);

			const insertedDocs: Data[] = [];

			type RawKey = keyof Raw;

			const promises: Promise<void>[] = this.#dataToInsert.map((data) => {
				return new Promise((res, rej) => {
					// Apply default values for missing fields
					const updated = { ...data };

					if (this.#columns) {
						Object.entries(this.#columns).forEach(([fieldName, column]) => {
							const defaultValue = column[DefaultValue];

							if (!(fieldName in updated) && defaultValue !== undefined) {
								updated[fieldName as RawKey] = defaultValue;
							}

							const columnType = column[ColumnType];
							if (columnType === 'uuid' && !(fieldName in updated)) {
								updated[fieldName as RawKey] = uuidV4() as Raw[RawKey];
							}

							if (columnType === 'timestamp' && !(fieldName in updated)) {
								updated[fieldName as RawKey] = getTimestamp() as Raw[RawKey];
							}
						});
					}

					const request = store.add(updated);

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

/**
 * Update query builder.
 */
export class UpdateQuery<T extends GenericObject, S extends Table> {
	#table: string;
	#dbGetter: () => IDBDatabase;
	#readyPromise: Promise<void>;
	#dataToUpdate?: InferUpdateType<S>;
	#whereCondition?: (row: T) => boolean;

	constructor(table: string, dbGetter: () => IDBDatabase, readyPromise: Promise<void>) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;
	}

	set(values: InferUpdateType<S>) {
		this.#dataToUpdate = values;
		return this;
	}

	where(predicate: (row: T) => boolean) {
		this.#whereCondition = predicate;
		return this;
	}

	async run(): Promise<number> {
		await this.#readyPromise;

		if (!isNotEmptyObject(this.#dataToUpdate)) {
			throw new Error('No values set for update!');
		}

		return new Promise((resolve, reject) => {
			const transaction = this.#dbGetter().transaction(this.#table, 'readwrite');
			const store = transaction.objectStore(this.#table);
			const request = store.getAll();

			let updateCount = 0;

			request.onsuccess = () => {
				let rows: T[] = request.result;

				if (this.#whereCondition) {
					rows = rows.filter(this.#whereCondition);
				}

				const updatePromises = rows.map((row) => {
					return new Promise<void>((res, rej) => {
						const updatedRow = { ...row, ...this.#dataToUpdate };
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

/**
 * Delete query builder.
 */
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

	where(predicate: (row: T) => boolean) {
		this.#whereCondition = predicate;
		return this;
	}

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
