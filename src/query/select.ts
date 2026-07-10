import { avgByField, sortAnArray, sumByField } from 'toolbox-x';
import { isFunction, isNonEmptyString, isNotEmptyObject } from 'toolbox-x/guards';
import type { Table } from '../core';
import { _extractErrorMsg } from '../helpers';
import { Selected } from '../symbols';
import type {
	$InferIndex,
	$InferPrimaryKey,
	CursorCallback,
	DistinctFieldValues,
	FirstOverloadParams,
	ForcedAny,
	GenericObject,
	IDBGetter,
	Maybe,
	NestedPrimitiveKey,
	Nullable,
	NumericDotKey,
	PageOptions,
	PageResult,
	RejectFn,
	SelectFields,
	SortDirection,
	WherePredicate,
} from '../types';

type BoolRecord = Partial<Record<string, boolean>>;

/** @class Select query builder. */
export class SelectQuery<
	Row extends GenericObject,
	Sel extends Nullable<BoolRecord> = null,
	Tbl extends Table = Table,
> {
	#table: string;
	#readyPromise: Promise<void>;

	#dbGetter: IDBGetter;
	#whereCondition?: WherePredicate<Row>;
	#whereIndexName?: string;
	#whereIndexQuery?: IDBKeyRange;

	#orderByKey?: NestedPrimitiveKey<Row>;
	#orderByDir: SortDirection = 'asc';
	#limitCount?: number;
	#useIndexCursor?: boolean;

	#transaction?: IDBTransaction;

	declare [Selected]?: Sel;

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

	/** @internal Clone this query into a new instance with all current state */
	#clone(): SelectQuery<Row, Sel, Tbl> {
		const query = new SelectQuery<Row, Sel, Tbl>(
			this.#table,
			this.#dbGetter,
			this.#readyPromise,
			this.#transaction
		);

		query[Selected] = this[Selected];
		query.#whereCondition = this.#whereCondition;
		query.#whereIndexName = this.#whereIndexName;
		query.#whereIndexQuery = this.#whereIndexQuery;
		query.#orderByKey = this.#orderByKey;
		query.#orderByDir = this.#orderByDir;
		query.#limitCount = this.#limitCount;
		query.#useIndexCursor = this.#useIndexCursor;

		return query;
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
	#sort(data: Row[]): Row[] {
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
	 * @instance Filter rows based on predicate function
	 * @param predicate Filtering function
	 */
	where(predicate: WherePredicate<Row>): this;

	/**
	 * @instance Filter rows based on index query
	 * @param indexName Name of the index/primary key to query
	 * @param query Key value or {@link IDBKeyRange} to search for
	 */
	where<IdxKey extends $InferPrimaryKey<Tbl['columns']> | $InferIndex<Tbl['columns']>>(
		indexName: IdxKey,
		query: IDBKeyRange | Row[IdxKey]
	): this;

	where<IdxKey extends $InferPrimaryKey<Tbl['columns']> | $InferIndex<Tbl['columns']>>(
		condition: WherePredicate<Row> | IdxKey,
		query?: IDBKeyRange | Row[IdxKey]
	) {
		const cloned = this.#clone();

		if (isFunction(condition)) {
			cloned.#whereCondition = condition;
			cloned.#whereIndexName = undefined;
			cloned.#whereIndexQuery = undefined;
		} else if (isNonEmptyString(condition) && query != null) {
			cloned.#whereIndexName = condition;
			cloned.#whereIndexQuery = query;
			cloned.#whereCondition = undefined;
		}

		return cloned;
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
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();

			// If we have an index-based where query, use it
			if (this.#whereIndexName && this.#whereIndexQuery != null) {
				const source = this.#buildIndexedStore(store, reject);

				if (!source) return;

				const request = source.getAll(this.#whereIndexQuery) as IDBRequest<Row[]>;

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
			} else {
				// Use standard getAll with in-memory sorting
				const request = store.getAll() as IDBRequest<Row[]>;

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
		await this.#readyPromise;
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

			if (options.cursor != null && this.#whereIndexQuery != null) {
				reject(
					new Error(
						'page() does not support cursor pagination with index where queries.'
					)
				);
				return;
			}

			const limit = options.limit ?? this.#limitCount;
			if (limit !== undefined && limit < 0) {
				reject(new RangeError('page() limit must be a non-negative number.'));
				return;
			}

			if (limit === 0) {
				resolve({
					items: [] as Row[],
					nextCursor: options.cursor ?? null,
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

			if (this.#whereIndexName && this.#whereIndexQuery != null) {
				source = this.#buildIndexedStore(store, reject);
				if (!source) return;
				range = this.#whereIndexQuery;
			} else if (useIdxCursor) {
				source = store.index(this.#orderByKey as string);
			} else {
				source = store;
			}

			const direction = this.#orderByDir === 'desc' ? 'prev' : 'next';

			if (options.cursor != null) {
				range =
					direction === 'prev'
						? IDBKeyRange.upperBound(options.cursor, true)
						: IDBKeyRange.lowerBound(options.cursor, true);
			}

			const request = source.openCursor(range ?? null, direction);
			const items: Partial<Row>[] = [];
			let count = 0;

			request.onsuccess = () => {
				const cursor = request.result;

				if (!cursor) {
					resolve({
						items: items as PageResult<Row, Selection>['items'],
						nextCursor: undefined,
					});
					return;
				}

				const row = cursor.value as Row;

				if (this.#whereCondition && !this.#whereCondition(row)) {
					cursor.continue();
					return;
				}

				items.push(this.#projectRow(row));
				count++;

				if (limit && count >= limit) {
					resolve({
						items: items as PageResult<Row, Selection>['items'],
						nextCursor: cursor.key,
					});
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
		await this.#readyPromise;
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

			if (this.#whereIndexName && this.#whereIndexQuery != null) {
				source = this.#buildIndexedStore(store, reject);
				if (!source) return;
				range = this.#whereIndexQuery;
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

				if (this.#whereCondition && !this.#whereCondition(row)) {
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

	async findFirst() {
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();

			// If we have an index-based where query, use it
			if (this.#whereIndexName && this.#whereIndexQuery != null) {
				const source = this.#buildIndexedStore(store, reject);

				if (!source) return;

				const request = source.getAll(this.#whereIndexQuery) as IDBRequest<Row[]>;

				request.onsuccess = () => {
					const results = this.#applyPipeline(request.result);
					resolve(results.length > 0 ? results[0] : null);
				};

				request.onerror = () => reject(request.error);
				return;
			}

			const request = store.getAll() as IDBRequest<Row[]>;

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
		key: $InferPrimaryKey<Tbl['columns']> extends keyof Row
			? Row[$InferPrimaryKey<Tbl['columns']>]
			: Row[keyof Row]
	): Promise<
		Sel extends null
			? Nullable<Row>
			: Sel extends Partial<Record<keyof Row, boolean>>
				? Nullable<SelectFields<Row, Sel>>
				: never
	> {
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const { store } = this.#getStore();
			const request = store.get(key) as IDBRequest<Row>;

			type ResolvedData = Sel extends null
				? Nullable<Row>
				: Sel extends Partial<Record<keyof Row, boolean>>
					? Nullable<SelectFields<Row, Sel>>
					: never;

			request.onsuccess = () => {
				const result = request.result as Maybe<Row>;

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
	async findByIndex<IdxKey extends $InferIndex<Tbl['columns']> & keyof Row & string>(
		indexName: IdxKey,
		query: Row[IdxKey] | IDBKeyRange
	): Promise<
		Sel extends null
			? Row[]
			: Sel extends Partial<Record<keyof Row, boolean>>
				? SelectFields<Row, Sel>[]
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
			const request = index.getAll(query) as IDBRequest<Row[]>;

			request.onsuccess = () => {
				let results = request.result;

				// Apply where filter
				if (this.#whereCondition) {
					results = results.filter(this.#whereCondition);
				}

				resolve(
					this.#applyPipeline(results) as Sel extends null
						? Row[]
						: Sel extends Partial<Record<keyof Row, boolean>>
							? SelectFields<Row, Sel>[]
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
			if (this.#whereIndexName && this.#whereIndexQuery != null) {
				const source = this.#buildIndexedStore(store, reject);

				if (!source) return;

				const request = source.count(this.#whereIndexQuery);

				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
				return;
			}

			// If we have a predicate-based where condition, we need to get all and filter
			if (this.#whereCondition) {
				const request = store.getAll() as IDBRequest<Row[]>;

				request.onsuccess = () => {
					const filtered = request.result.filter(
						this.#whereCondition as WherePredicate<Row>
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

	async exists(): Promise<boolean> {
		const count = await this.count();

		return count > 0;
	}

	async sum(
		this: SelectQuery<Row, null, Tbl>,
		column: NumericDotKey<Row>,
		roundTo?: number
	): Promise<number>;

	async sum<Selection extends Partial<Record<keyof Row, boolean>>>(
		this: SelectQuery<Row, Selection, Tbl>,
		column: NumericDotKey<SelectFields<Row, Selection>>,
		roundTo?: number
	): Promise<number>;

	async sum(
		this: SelectQuery<Row, null, Tbl>,
		column: NumericDotKey<Row>,
		roundTo = 2
	): Promise<number> {
		try {
			const items = await this.findAll();

			const result = sumByField(items, column, roundTo);

			return result;
		} catch (error) {
			throw new Error(
				`Error computing sum for column '${column}': ${_extractErrorMsg(error)}`
			);
		}
	}

	async avg(
		this: SelectQuery<Row, null, Tbl>,
		column: NumericDotKey<Row>,
		roundTo?: number
	): Promise<number>;

	async avg<Selection extends Partial<Record<keyof Row, boolean>>>(
		this: SelectQuery<Row, Selection, Tbl>,
		column: NumericDotKey<SelectFields<Row, Selection>>,
		roundTo?: number
	): Promise<number>;

	async avg(
		this: SelectQuery<Row, null, Tbl>,
		column: NumericDotKey<Row>,
		roundTo = 2
	): Promise<number> {
		try {
			const items = await this.findAll();

			const result = avgByField(items, column, roundTo);

			return result;
		} catch (error) {
			throw new Error(
				`Error computing average for column '${column}': ${_extractErrorMsg(error)}`
			);
		}
	}

	async distinct<Col extends keyof Row>(
		this: SelectQuery<Row, null, Tbl>,
		column: Col
	): Promise<DistinctFieldValues<Row, Col>>;

	async distinct<
		Selection extends Partial<Record<keyof Row, boolean>>,
		Col extends keyof SelectFields<Row, Selection>,
	>(
		this: SelectQuery<Row, Selection, Tbl>,
		column: Col
	): Promise<DistinctFieldValues<SelectFields<Row, Selection>, Col>>;

	async distinct<Selection extends Partial<Record<keyof Row, boolean>>>(
		this: SelectQuery<Row, null, Tbl> | SelectQuery<Row, Selection, Tbl>,
		column: keyof Row | keyof SelectFields<Row, Selection>
	) {
		try {
			const items = await (this as SelectQuery<Row, null, Tbl>).findAll();

			const result = items.map((it) => it[column as keyof Row]);

			return [...new Set(result)];
		} catch (error) {
			throw new Error(
				`Error computing distinct values for column '${column as string}': ${_extractErrorMsg(error)}`
			);
		}
	}
}
