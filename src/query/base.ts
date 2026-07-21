import { isFunction, isNonEmptyString } from 'toolbox-x/guards';
import type { Table } from '../core';
import type {
	$InferIndex,
	$InferPrimaryKey,
	ColumnDefinition,
	GenericObject,
	IDBGetter,
	RejectFn,
	SchemaDefinition,
	WherePredicate,
} from '../types';

export class BaseQuery<Row extends GenericObject, T extends Table> {
	protected readonly $table: string;
	protected readonly $dbGetter: IDBGetter;
	protected readonly $readyPromise: Promise<void>;
	protected readonly $columns?: ColumnDefinition;
	protected readonly $schema?: SchemaDefinition;

	protected $whereIndexName?: string;
	protected $whereCondition?: WherePredicate<Row>;
	protected $whereIndexQuery?: IDBKeyRange | IDBValidKey;

	protected $trx?: IDBTransaction;

	constructor(
		tableName: string,
		dbGetter: IDBGetter,
		readyPromise: Promise<void>,
		transaction?: IDBTransaction,
		schema?: SchemaDefinition,
		columns?: ColumnDefinition
	) {
		this.$table = tableName;
		this.$dbGetter = dbGetter;
		this.$readyPromise = readyPromise;
		this.$trx = transaction;
		this.$schema = schema;
		this.$columns = columns;
	}

	/** @internal Build indexed store (primary key or index) for where queries */
	protected $buildIndexedStore(store: IDBObjectStore, reject: RejectFn) {
		const isPrimaryKey =
			isNonEmptyString(this.$whereIndexName) && store.keyPath === this.$whereIndexName;

		const hasIndexed =
			isNonEmptyString(this.$whereIndexName) &&
			store.indexNames.contains(this.$whereIndexName);

		if (!isPrimaryKey && !hasIndexed) {
			reject(
				new RangeError(
					`Index '${this.$whereIndexName}' does not exist on table '${this.$table}'`
				)
			);

			return null;
		}

		// Primary keys use store directly, indexes use store.index()
		return isPrimaryKey ? store : store.index(this.$whereIndexName as string);
	}

	/**
	 * @instance Filter rows by predicate function
	 *
	 * @remarks
	 * - This overload allows you to filter rows based on a predicate function that receives each row
	 *   and returns a boolean indicating whether the row should be included in the result set.
	 * - It is less efficient than filtering by index, as it requires iterating over all rows in the store.
	 * - Use this overload when you need to filter rows based on complex conditions that cannot be expressed using an index.
	 *
	 * @param predicate Filtering function
	 */
	where(predicate: WherePredicate<Row>): this;

	/**
	 * @instance Filter rows by index name and query value
	 *
	 * @remarks
	 * - This overload allows you to filter rows based on a specific index and a query value.
	 * - The index name should correspond to an existing index in the table's schema, and the query
	 *   can be either a specific key value or an IDBKeyRange for more complex queries.
	 * - It is much more efficient to use this overload than the predicate function overload,
	 *   as it leverages IndexedDB's indexing capabilities.
	 *
	 * @param indexName Index name to query
	 * @param query Key value or {@link IDBKeyRange} to search for
	 */
	where<IdxKey extends $InferPrimaryKey<T['columns']> | $InferIndex<T['columns']>>(
		indexName: IdxKey,
		query: IDBKeyRange | Row[IdxKey]
	): this;

	where<IdxKey extends $InferPrimaryKey<T['columns']> | $InferIndex<T['columns']>>(
		condition: WherePredicate<Row> | IdxKey,
		query?: IDBKeyRange | Row[IdxKey]
	): this {
		if (isFunction(condition)) {
			this.$whereCondition = condition;
			this.$whereIndexName = undefined;
			this.$whereIndexQuery = undefined;
		} else if (isNonEmptyString(condition) && query != null) {
			this.$whereIndexName = condition;
			this.$whereIndexQuery = query;
			this.$whereCondition = undefined;
		}

		return this;
	}
}
