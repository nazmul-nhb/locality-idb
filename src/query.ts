import { sortAnArray } from 'nhb-toolbox';
import { uuid } from 'nhb-toolbox/hash';
import type { GenericObject, NestedPrimitiveKey } from 'nhb-toolbox/object/types';
import type { Table } from './core';
import type { ColumnDefinition, InferUpdateType } from './types';

export type SortDirection = 'asc' | 'desc';

/**
 * Select query builder.
 */
export class SelectQuery<T extends GenericObject> {
	#table: string;
	#readyPromise: Promise<void>;
	#dbGetter: () => IDBDatabase;
	#whereCondition?: (row: T) => boolean;
	#orderByKey?: NestedPrimitiveKey<T>;
	#orderByDir: SortDirection = 'asc';
	#limitCount?: number;

	constructor(table: string, dbGetter: () => IDBDatabase, readyPromise: Promise<void>) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;
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

	async all(): Promise<T[]> {
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
					// results.sort((a, b) => {
					// 	const aVal = a[this.orderByKey as keyof T];
					// 	const bVal = b[this.orderByKey as keyof T];
					// 	const cmp =
					// 		aVal < bVal ? -1
					// 		: aVal > bVal ? 1
					// 		: 0;
					// 	return this.orderByDir === 'asc' ? cmp : -cmp;
					// });
					results = sortAnArray(results, {
						sortOrder: this.#orderByDir,
						sortByField: this.#orderByKey,
					});
				}

				// Apply limit
				if (this.#limitCount) {
					results = results.slice(0, this.#limitCount);
				}

				resolve(results);
			};

			request.onerror = () => reject(request.error);
		});
	}

	async first(): Promise<T | null> {
		await this.#readyPromise;
		const results = await this.all();
		return results[0] || null;
	}
}

/**
 * Insert query builder.
 */
export class InsertQuery<T extends GenericObject> {
	private table: string;
	private dbGetter: () => IDBDatabase;
	private readyPromise: Promise<void>;
	private dataToInsert: T[] = [];
	private columns?: ColumnDefinition;

	constructor(
		table: string,
		dbGetter: () => IDBDatabase,
		readyPromise: Promise<void>,
		columns?: ColumnDefinition
	) {
		this.table = table;
		this.dbGetter = dbGetter;
		this.readyPromise = readyPromise;
		this.columns = columns;
	}

	values(data: T | T[]) {
		this.dataToInsert = Array.isArray(data) ? data : [data];
		return this;
	}

	async run(): Promise<void> {
		await this.readyPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.dbGetter().transaction(this.table, 'readwrite');
			const store = transaction.objectStore(this.table);

			const promises: Promise<void>[] = this.dataToInsert.map((data) => {
				return new Promise((res, rej) => {
					// Apply default values for missing fields
					const recordWithDefaults = { ...data };

					if (this.columns) {
						Object.entries(this.columns).forEach(([fieldName, column]) => {
							if (
								!(fieldName in recordWithDefaults) &&
								column.defaultValue !== undefined
							) {
								recordWithDefaults[fieldName as keyof T] = column.defaultValue;
							}

							if (column.type === 'uuid' && !(fieldName in recordWithDefaults)) {
								recordWithDefaults[fieldName as keyof T] = uuid() as T[keyof T];
							}

							if (
								column.type === 'timestamp' &&
								!(fieldName in recordWithDefaults)
							) {
								recordWithDefaults[fieldName as keyof T] =
									new Date().toISOString() as T[keyof T];
							}
						});
					}

					const request = store.add(recordWithDefaults);
					request.onsuccess = () => res();
					request.onerror = () => rej(request.error);
				});
			});

			transaction.oncomplete = () =>
				Promise.all(promises)
					.then(() => resolve())
					.catch(reject);
			transaction.onerror = () => reject(transaction.error);
		});
	}
}

/**
 * Update query builder.
 */
export class UpdateQuery<T extends GenericObject, S extends Table> {
	private table: string;
	private dbGetter: () => IDBDatabase;
	private readyPromise: Promise<void>;
	private dataToUpdate?: InferUpdateType<S>;
	private whereCondition?: (row: T) => boolean;

	constructor(table: string, dbGetter: () => IDBDatabase, readyPromise: Promise<void>) {
		this.table = table;
		this.dbGetter = dbGetter;
		this.readyPromise = readyPromise;
	}

	set(values: InferUpdateType<S>) {
		this.dataToUpdate = values;
		return this;
	}

	where(predicate: (row: T) => boolean) {
		this.whereCondition = predicate;
		return this;
	}

	async run(): Promise<number> {
		await this.readyPromise;
		if (!this.dataToUpdate) {
			throw new Error('No values set for update');
		}

		return new Promise((resolve, reject) => {
			const transaction = this.dbGetter().transaction(this.table, 'readwrite');
			const store = transaction.objectStore(this.table);
			const request = store.getAll();

			let updateCount = 0;

			request.onsuccess = () => {
				let rows: T[] = request.result;

				if (this.whereCondition) {
					rows = rows.filter(this.whereCondition);
				}

				const updatePromises = rows.map((row) => {
					return new Promise<void>((res, rej) => {
						const updatedRow = { ...row, ...this.dataToUpdate };
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
export class DeleteQuery<T extends GenericObject> {
	private table: string;
	private dbGetter: () => IDBDatabase;
	private readyPromise: Promise<void>;
	private keyField: string;
	private whereCondition?: (row: T) => boolean;

	constructor(
		table: string,
		dbGetter: () => IDBDatabase,
		readyPromise: Promise<void>,
		keyField: string
	) {
		this.table = table;
		this.dbGetter = dbGetter;
		this.readyPromise = readyPromise;
		this.keyField = keyField;
	}

	where(predicate: (row: T) => boolean) {
		this.whereCondition = predicate;
		return this;
	}

	async run(): Promise<number> {
		await this.readyPromise;
		return new Promise((resolve, reject) => {
			const transaction = this.dbGetter().transaction(this.table, 'readwrite');
			const store = transaction.objectStore(this.table);
			const request = store.getAll();

			let deleteCount = 0;

			request.onsuccess = () => {
				let rows: T[] = request.result;

				if (this.whereCondition) {
					rows = rows.filter(this.whereCondition);
				}

				const deletePromises = rows.map((row) => {
					return new Promise<void>((res, rej) => {
						const key = (row as any)[this.keyField];
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
