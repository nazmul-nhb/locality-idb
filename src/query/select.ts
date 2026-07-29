import {
	avgByField,
	normalizeNumber,
	removeDuplicates,
	sortAnArray,
	sumByField,
} from 'toolbox-x';
import { isNonEmptyString, isNotEmptyObject } from 'toolbox-x/guards';
import type { Table } from '../core';
import { _extractErrorMsg, _resolveNestedKey } from '../helpers';
import { Selected } from '../symbols';
import type {
	$InferIndex,
	$InferPrimaryKey,
	BooleanRecord,
	CursorCallback,
	ForcedAny,
	GenericObject,
	IDBGetter,
	IndexedResult,
	Maybe,
	NestedPrimitiveKey,
	Nullable,
	NumericDotKey,
	PageOptions,
	PageResult,
	ResolveValue,
	SelectFields,
	SortDirection,
	WherePredicate,
} from '../types';
import { BaseQuery } from './base';

/** @class Select query builder. */
export class SelectQuery<
	Row extends GenericObject,
	Sel extends BooleanRecord = null,
	Tbl extends Table = Table,
> extends BaseQuery<Row, Tbl> {
	#orderByKey?: NestedPrimitiveKey<Row>;
	#orderByDir: SortDirection = 'asc';
	#limitCount?: number;
	#useIndexCursor?: boolean;

	declare [Selected]?: Sel;

	constructor(
		tableName: string,
		dbGetter: IDBGetter,
		readyPromise: Promise<void>,
		transaction?: IDBTransaction
	) {
		super(tableName, dbGetter, readyPromise, transaction);
	}

	/** @internal Clone this query into a new instance with all current state */
	#clone(): SelectQuery<Row, Sel, Tbl> {
		const query = new SelectQuery<Row, Sel, Tbl>(
			this.$table,
			this.$dbGetter,
			this.$readyPromise,
			this.$trx
		);

		query[Selected] = this[Selected];
		query.$whereCondition = this.$whereCondition;
		query.$whereIndexName = this.$whereIndexName;
		query.$whereIndexQuery = this.$whereIndexQuery;
		query.#orderByKey = this.#orderByKey;
		query.#orderByDir = this.#orderByDir;
		query.#limitCount = this.#limitCount;
		query.#useIndexCursor = this.#useIndexCursor;

		return query;
	}

	/** @internal Get filtered rows without sorting, limiting, or projecting */
	async #getFilteredRows(): Promise<Row[]> {
		await this.$readyPromise;

		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();

			// If we have an index-based where query, use it
			if (this.$whereIndexName && this.$whereIndexQuery != null) {
				const source = this.$buildIndexedStore(store, reject);

				if (!source) return;

				const request = source.getAll(this.$whereIndexQuery) as IDBRequest<Row[]>;

				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);

				return;
			}

			const request = store.getAll() as IDBRequest<Row[]>;

			request.onsuccess = () => {
				let results = request.result;

				if (this.$whereCondition) {
					results = results.filter(this.$whereCondition);
				}

				resolve(results);
			};

			request.onerror = () => reject(request.error);
		});
	}

	/** @internal Resolve a dot-notation key to a numeric value from a row */
	#resolveValue(row: Row, key: string): number {
		const value = _resolveNestedKey(row, key);

		return normalizeNumber(value) ?? NaN;
	}

	/** @internal Create a readonly transaction and return the store */
	#getStore(): { transaction: IDBTransaction; store: IDBObjectStore } {
		const trx = this.$trx ?? this.$dbGetter().transaction(this.$table, 'readonly');
		const store = trx.objectStore(this.$table);
		return { transaction: trx, store };
	}

	/** @internal Sort data in memory if needed */
	#sort(data: Row[]): Row[] {
		if (this.#orderByKey) {
			return sortAnArray(data, {
				sortOrder: this.#orderByDir,
				sortByField: this.#orderByKey,
			});
		}

		return data;
	}

	/** @internal Apply sort, limit, and projection pipeline to results */
	#applyPipeline(results: Row[]): Partial<Row>[] {
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
	#projectRow(row: Row): Partial<Row> {
		type Key = keyof Row;

		if (!isNotEmptyObject(this?.[Selected])) return row;

		const projected: Partial<Row> = {};

		const selectionEntries = Object.entries<boolean>(this[Selected]);
		const selectionKeys = new Set(Object.keys(this[Selected]));

		// Check if any value is true
		const hasTrueValues = selectionEntries.some(([_, value]) => value === true);

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
	select<Selection extends Partial<Record<keyof Row, boolean>>>(cols: Selection) {
		const query = this.#clone() as unknown as SelectQuery<Row, Selection, Tbl>;

		query[Selected] = cols;

		return query;
	}

	/**
	 * @instance Order results by specified key and direction
	 * @param key Key to order by
	 * @param dir Direction: 'asc' | 'desc' (default: 'asc')
	 *
	 * @remarks
	 * - This method performs in-memory sorting.
	 * - For optimized sorting using `IndexedDB` indexes, use {@link sortByIndex} instead.
	 */
	orderBy<Key extends NestedPrimitiveKey<Row>>(key: Key, dir: SortDirection = 'asc'): this {
		const cloned = this.#clone();

		cloned.#orderByKey = key;
		cloned.#orderByDir = dir;

		return cloned as this;
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
		const cloned = this.#clone();

		cloned.#orderByKey = indexName as unknown as NestedPrimitiveKey<Row>;
		cloned.#orderByDir = dir;
		cloned.#useIndexCursor = true;

		return cloned as this;
	}

	/**
	 * @instance Limit number of results
	 * @param count Maximum number of results to return
	 */
	limit(count: number): this {
		const cloned = this.#clone();
		cloned.#limitCount = count;
		return cloned as this;
	}

	/** Fetch all matching records */
	async findAll(this: SelectQuery<Row, null, Tbl>): Promise<Row[]>;

	/** Fetch all matching records with selected fields */
	async findAll<Selection extends Partial<Record<keyof Row, boolean>>>(
		this: SelectQuery<Row, Selection, Tbl>
	): Promise<SelectFields<Row, Selection>[]>;

	async findAll() {
		await this.$readyPromise;

		const { store } = this.#getStore();

		// Validate index key if sortByIndex was used
		if (this.#useIndexCursor && this.#orderByKey && isNonEmptyString(this.#orderByKey)) {
			const isPK = store.keyPath === this.#orderByKey;
			const isIndex = store.indexNames.contains(this.#orderByKey);

			if (!isPK && !isIndex) {
				throw new RangeError(
					`Index '${this.#orderByKey}' does not exist on table '${this.$table}'`
				);
			}
		}

		// Check if we can use an optimized index cursor (sortByIndex without predicate where or index where)
		const useIdxCursor =
			this.#useIndexCursor &&
			this.#orderByKey &&
			isNonEmptyString(this.#orderByKey) &&
			!this.$whereCondition &&
			!this.$whereIndexName;

		if (useIdxCursor) {
			return new Promise((resolve, reject) => {
				const isPK = store.keyPath === this.#orderByKey;
				const source = isPK ? store : store.index(this.#orderByKey as string);
				const direction = this.#orderByDir === 'desc' ? 'prev' : 'next';
				const request = source.openCursor(null, direction);
				const results: Row[] = [];

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
			});
		}

		// Standard path: get filtered rows, then apply sort + limit + projection
		const rows = await this.#getFilteredRows();

		return this.#applyPipeline(rows);
	}

	/** Fetch records with cursor-based pagination */
	async page(
		this: SelectQuery<Row, null, Tbl>,
		options?: PageOptions
	): Promise<PageResult<Row, null>>;

	/** Fetch records with cursor-based pagination and selected fields */
	async page<Selection extends Partial<Record<keyof Row, boolean>>>(
		this: SelectQuery<Row, Selection, Tbl>,
		options?: PageOptions
	): Promise<PageResult<Row, Selection>>;

	async page<Selection extends Partial<Record<keyof Row, boolean>>>(
		this: SelectQuery<Row, Nullable<Selection>>,
		options: PageOptions = {}
	) {
		await this.$readyPromise;

		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();

			if (this.#orderByKey && !this.#useIndexCursor) {
				reject(
					new Error(
						'page() does not support in-memory orderBy. Use sortByIndex() instead.'
					)
				);
				return;
			}

			const { limit = this.#limitCount, cursor } = options;

			if (options.cursor != null && this.$whereIndexQuery != null) {
				reject(
					new Error(
						'page() does not support cursor pagination with index where queries.'
					)
				);
				return;
			}

			if (limit != null && limit < 0) {
				reject(new RangeError('page() limit must be a non-negative number.'));
				return;
			}

			if (limit === 0) {
				resolve({
					items: [] as Row[],
					nextCursor: cursor,
				} as PageResult<Row, Selection>);
				return;
			}

			const useIdxCursor =
				this.#useIndexCursor &&
				this.#orderByKey &&
				isNonEmptyString(this.#orderByKey) &&
				store.indexNames.contains(this.#orderByKey);

			let source: Nullable<IDBObjectStore | IDBIndex> = null;
			let range: Nullable<IDBKeyRange | IDBValidKey> = null;

			if (this.$whereIndexName && this.$whereIndexQuery != null) {
				source = this.$buildIndexedStore(store, reject);
				if (!source) return;
				range = this.$whereIndexQuery;
			} else if (useIdxCursor) {
				source = store.index(this.#orderByKey as string);
			} else {
				source = store;
			}

			const direction = this.#orderByDir === 'desc' ? 'prev' : 'next';

			if (cursor != null) {
				range =
					direction === 'prev'
						? IDBKeyRange.upperBound(cursor, true)
						: IDBKeyRange.lowerBound(cursor, true);
			}

			const request = source.openCursor(range ?? null, direction);
			const items: Partial<Row>[] = [];
			let count = 0;

			request.onsuccess = () => {
				const cursor = request.result;

				if (!cursor) {
					resolve({
						items: items,
						nextCursor: undefined,
					} as PageResult<Row, Selection>);
					return;
				}

				const row = cursor.value as Row;

				if (this.$whereCondition && !this.$whereCondition(row)) {
					cursor.continue();
					return;
				}

				items.push(this.#projectRow(row));
				count++;

				if (limit && count >= limit) {
					resolve({
						items: items,
						nextCursor: cursor.key,
					} as PageResult<Row, Selection>);
					return;
				}

				cursor.continue();
			};

			request.onerror = () => reject(request.error);
		});
	}

	/** Stream records with a cursor */
	async stream(
		this: SelectQuery<Row, null, Tbl>,
		callback: CursorCallback<Row>
	): Promise<void>;

	/** Stream records with a cursor and selected fields */
	async stream<Selection extends Partial<Record<keyof Row, boolean>>>(
		this: SelectQuery<Row, Selection, Tbl>,
		callback: CursorCallback<SelectFields<Row, Selection>>
	): Promise<void>;

	async stream<Selection extends Partial<Record<keyof Row, boolean>>>(
		this: SelectQuery<Row, Selection, Tbl>,
		callback: CursorCallback<Row> | CursorCallback<SelectFields<Row, Selection>>
	) {
		await this.$readyPromise;

		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();

			if (this.#orderByKey && !this.#useIndexCursor) {
				reject(
					new Error(
						'stream() does not support in-memory orderBy. Use sortByIndex() instead.'
					)
				);
				return;
			}

			const useIdxCursor =
				this.#useIndexCursor &&
				this.#orderByKey &&
				isNonEmptyString(this.#orderByKey) &&
				store.indexNames.contains(this.#orderByKey);

			let source: Nullable<IDBObjectStore | IDBIndex> = null;
			let range: Nullable<IDBKeyRange | IDBValidKey> = null;

			if (this.$whereIndexName && this.$whereIndexQuery != null) {
				source = this.$buildIndexedStore(store, reject);
				if (!source) return;
				range = this.$whereIndexQuery;
			} else if (useIdxCursor) {
				source = store.index(this.#orderByKey as string);
			} else {
				source = store;
			}

			const direction = this.#orderByDir === 'desc' ? 'prev' : 'next';
			const request = source.openCursor(range ?? null, direction);
			let index = 0;

			request.onsuccess = () => {
				const cursor = request.result;

				if (!cursor) {
					resolve(void 0);
					return;
				}

				const row = cursor.value as Row;

				if (this.$whereCondition && !this.$whereCondition(row)) {
					cursor.continue();
					return;
				}

				const projectedRow = this.#projectRow(row) as ForcedAny;

				Promise.resolve(callback(projectedRow, index))
					.then(() => {
						index++;
						cursor.continue();
					})
					.catch((err) => reject(err));
			};

			request.onerror = () => reject(request.error);
		});
	}

	/** Fetch first matching record */
	async findFirst(this: SelectQuery<Row, null, Tbl>): Promise<Nullable<Row>>;

	/** Fetch first matching record with selected fields */
	async findFirst<Selection extends Partial<Record<keyof Row, boolean>>>(
		this: SelectQuery<Row, Selection, Tbl>
	): Promise<Nullable<SelectFields<Row, Selection>>>;

	async findFirst(this: SelectQuery<Row, ForcedAny, Tbl>): Promise<ForcedAny> {
		const rows = await this.#getFilteredRows();
		const processed = this.#applyPipeline(rows);

		return processed.length > 0 ? processed[0] : null;
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
		key: $InferPrimaryKey<Tbl['columns']> extends keyof Row
			? Row[$InferPrimaryKey<Tbl['columns']>]
			: Row[keyof Row]
	): Promise<Nullable<IndexedResult<Sel, Row>>> {
		await this.$readyPromise;

		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();
			const request = store.get(key) as IDBRequest<Row>;

			request.onsuccess = () => {
				const result = request.result as Maybe<Row>;

				if (!result) {
					resolve(null);
					return;
				}

				// Apply where filter if specified
				if (this.$whereCondition && !this.$whereCondition(result)) {
					resolve(null);
					return;
				}

				// Apply projection
				resolve(this.#projectRow(result) as Nullable<IndexedResult<Sel, Row>>);
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
	async findByIndex<IdxKey extends $InferIndex<Tbl['columns']> & keyof Row & string>(
		indexName: IdxKey,
		query: Row[IdxKey] | IDBKeyRange
	): Promise<IndexedResult<Sel, Row>[]> {
		await this.$readyPromise;

		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();

			// Check if index exists
			if (!store.indexNames.contains(indexName)) {
				reject(
					new RangeError(
						`Index '${indexName}' does not exist on table '${this.$table}'`
					)
				);
				return;
			}

			const index = store.index(indexName);
			const request = index.getAll(query) as IDBRequest<Row[]>;

			request.onsuccess = () => {
				let results = request.result;

				// Apply where filter
				if (this.$whereCondition) {
					results = results.filter(this.$whereCondition);
				}

				resolve(this.#applyPipeline(results) as IndexedResult<Sel, Row>[]);
			};

			request.onerror = () => reject(request.error);
		});
	}

	/** @instance Count matching records */
	async count(): Promise<number> {
		await this.$readyPromise;

		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();

			// If we have an index-based where query, use it
			if (this.$whereIndexName && this.$whereIndexQuery != null) {
				const source = this.$buildIndexedStore(store, reject);

				if (!source) return;

				const request = source.count(this.$whereIndexQuery);

				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
				return;
			}

			// If we have a predicate-based where condition, we need to get all and filter
			if (this.$whereCondition) {
				const request = store.getAll() as IDBRequest<Row[]>;

				request.onsuccess = () => {
					const filtered = request.result.filter(
						this.$whereCondition as WherePredicate<Row>
					);

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

	/**
	 * @instance Checks if the query result set contains at least one record.
	 * @returns A promise that resolves to `true` if the query result set contains at least one record, `false` otherwise.
	 */
	async exists(): Promise<boolean> {
		const count = await this.count();

		return count > 0;
	}

	/**
	 * @instance Computes the sum of a numeric column.
	 * @param column Column to compute sum of. Supports dot-notation for nested fields.
	 * @param roundTo Number of decimal places to round to. @default 2
	 *
	 * @returns A promise that resolves to the sum of the specified column.
	 *
	 * @remarks
	 * - Operates on raw filtered rows (skips sort, limit, and projection for efficiency).
	 * - Independent of the {@link select()} method's column filtering.
	 */
	async sum(column: NumericDotKey<Row>, roundTo = 2): Promise<number> {
		try {
			const rows = await this.#getFilteredRows();

			return sumByField(rows, column, roundTo);
		} catch (error) {
			throw new Error(
				`Error computing sum for column '${column}': ${_extractErrorMsg(error)}`
			);
		}
	}

	/**
	 * @instance Computes the average of a numeric column.
	 * @param column Column to compute average of. Supports dot-notation for nested fields.
	 * @param roundTo Number of decimal places to round to. @default 2
	 *
	 * @returns A promise that resolves to the average of the specified column.
	 *
	 * @remarks
	 * - Operates on raw filtered rows (skips sort, limit, and projection for efficiency).
	 * - Independent of the {@link select()} method's column filtering.
	 */
	async avg(column: NumericDotKey<Row>, roundTo = 2): Promise<number> {
		try {
			const rows = await this.#getFilteredRows();

			return avgByField(rows, column, roundTo);
		} catch (error) {
			throw new Error(
				`Error computing average for column '${column}': ${_extractErrorMsg(error)}`
			);
		}
	}

	/**
	 * @instance Gets distinct values of a column.
	 * @param column Column to get distinct values of.
	 *
	 * @returns A promise that resolves to an array of distinct values of the specified column.
	 *
	 * @remarks
	 * - Operates on raw filtered rows (skips sort, limit, and projection for efficiency).
	 * - Independent of the {@link select()} method's column filtering.
	 */
	async distinct<Col extends keyof Row>(column: Col): Promise<ResolveValue<Row, Col>[]> {
		try {
			const rows = await this.#getFilteredRows();

			const result = rows.map((it) => it[column]);

			return removeDuplicates(result);
		} catch (error) {
			throw new Error(
				`Error computing distinct values for column '${column as string}': ${_extractErrorMsg(error)}`
			);
		}
	}

	/**
	 * @instance Finds the minimum value of a numeric column.
	 * @param column Column to find minimum of. Supports dot-notation for nested fields.
	 *
	 * @returns A promise that resolves to the minimum value, or `NaN` if the result set is empty.
	 *
	 * @remarks
	 * - Uses **O(1) `IndexedDB` cursor** when the column is indexed/primary key and no `where()` filters are active.
	 * - Falls back to scanning all filtered rows for non-indexed or nested columns.
	 * - Independent of the {@link select()} method's column filtering.
	 */
	async min(column: NumericDotKey<Row>): Promise<number> {
		try {
			await this.$readyPromise;

			const hasNoWhere = !this.$whereCondition && !this.$whereIndexName;
			const isTopLevel = !column.includes('.');

			// O(1) cursor optimization: first value in ascending order = min
			if (hasNoWhere && isTopLevel) {
				const { store } = this.#getStore();
				const isIndexed = store.indexNames.contains(column);
				const isPK = store.keyPath === column;

				if (isIndexed || isPK) {
					return new Promise((resolve, reject) => {
						const source = isPK ? store : store.index(column);
						const request = source.openCursor(null, 'next');

						request.onsuccess = () => {
							const cursor = request.result;
							resolve(cursor ? cursor.value[column] : NaN);
						};

						request.onerror = () => reject(request.error);
					});
				}
			}

			// Fallback: scan all filtered rows
			const rows = await this.#getFilteredRows();

			if (rows.length === 0) return NaN;

			return Math.min(...rows.map((r) => this.#resolveValue(r, column)));
		} catch (error) {
			throw new Error(
				`Error computing minimum value for column '${column}': ${_extractErrorMsg(error)}`
			);
		}
	}

	/**
	 * @instance Finds the maximum value of a numeric column.
	 * @param column Column to find maximum of. Supports dot-notation for nested fields.
	 *
	 * @returns A promise that resolves to the maximum value, or `NaN` if the result set is empty.
	 *
	 * @remarks
	 * - Uses **O(1) `IndexedDB` cursor** when the column is indexed/primary key and no `where()` filters are active.
	 * - Falls back to scanning all filtered rows for non-indexed or nested columns.
	 * - Independent of the {@link select()} method's column filtering.
	 */
	async max(column: NumericDotKey<Row>): Promise<number> {
		try {
			await this.$readyPromise;

			const hasNoWhere = !this.$whereCondition && !this.$whereIndexName;
			const isTopLevel = !column.includes('.');

			// O(1) cursor optimization: last value in descending order = max
			if (hasNoWhere && isTopLevel) {
				const { store } = this.#getStore();
				const isIndexed = store.indexNames.contains(column);
				const isPK = store.keyPath === column;

				if (isIndexed || isPK) {
					return new Promise((resolve, reject) => {
						const source = isPK ? store : store.index(column);
						const request = source.openCursor(null, 'prev');

						request.onsuccess = () => {
							const cursor = request.result;
							resolve(cursor ? cursor.value[column] : NaN);
						};

						request.onerror = () => reject(request.error);
					});
				}
			}

			// Fallback: scan all filtered rows
			const rows = await this.#getFilteredRows();

			if (rows.length === 0) return NaN;

			return Math.max(...rows.map((r) => this.#resolveValue(r, column)));
		} catch (error) {
			throw new Error(
				`Error computing maximum value for column '${column}': ${_extractErrorMsg(error)}`
			);
		}
	}
}
