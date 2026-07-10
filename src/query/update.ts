import { isFunction, isNonEmptyString, isNotEmptyObject } from 'toolbox-x/guards';
import type { Table } from '../core';
import { _abortTransaction } from '../helpers';
import type {
	$InferIndex,
	$InferPrimaryKey,
	ColumnDefinition,
	GenericObject,
	IDBGetter,
	InferUpdateType,
	RejectFn,
	UpdateCallback,
	WherePredicate,
} from '../types';
import { _validateAndPrepareData } from '../validators';

/** @class Update query builder. */
export class UpdateQuery<Row extends GenericObject, T extends Table> {
	#table: string;
	#dbGetter: IDBGetter;
	#readyPromise: Promise<void>;
	#dataToUpdate?: InferUpdateType<T>;
	#whereCondition?: WherePredicate<Row>;
	#updateCallback?: UpdateCallback<Row, T, InferUpdateType<T>>;
	#whereIndexName?: string;
	#whereIndexQuery?: IDBKeyRange | IDBValidKey;
	#columns?: ColumnDefinition;
	// TODO: Handle multiple primary keys later
	#keyPath?: string;

	#transaction?: IDBTransaction;

	constructor(
		table: string,
		dbGetter: IDBGetter,
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

	/**
	 * @instance Sets the data to be updated
	 * @param values Values to update
	 */
	set(values: InferUpdateType<T>): this;

	/**
	 * @instance Sets the computed data to be updated
	 * @param cb Callback function that receives the current row and returns the values to update
	 */
	set<U extends InferUpdateType<T>>(cb: UpdateCallback<Row, T, U>): this;

	set(values: InferUpdateType<T> | UpdateCallback<Row, T, InferUpdateType<T>>) {
		if (isFunction(values)) {
			this.#updateCallback = values;
		} else {
			this.#dataToUpdate = values;
		}

		return this;
	}

	/**
	 * @instance Filter rows to update
	 * @param predicate Filtering function
	 */
	where(predicate: WherePredicate<Row>): this;

	/**
	 * @instance Filter rows to update by index
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
			this.#whereCondition = condition;
			this.#whereIndexName = undefined;
			this.#whereIndexQuery = undefined;
		} else if (isNonEmptyString(condition) && query != null) {
			this.#whereIndexName = condition;
			this.#whereIndexQuery = query;
			this.#whereCondition = undefined;
		}

		return this;
	}

	/**
	 * @instance Executes the update query
	 * @returns Number of records updated
	 */
	async run(): Promise<number> {
		await this.#readyPromise;

		let dataToUpdate = this.#dataToUpdate;

		return new Promise((resolve, reject) => {
			const transaction =
				this.#transaction ?? this.#dbGetter().transaction(this.#table, 'readwrite');
			const store = transaction.objectStore(this.#table);

			let request: IDBRequest<Row[]>;

			if (this.#whereIndexName && this.#whereIndexQuery != null) {
				const source = this.#buildIndexedStore(store, reject);

				if (!source) return;

				request = source.getAll(this.#whereIndexQuery) as IDBRequest<Row[]>;
			} else {
				request = store.getAll() as IDBRequest<Row[]>;
			}

			let updateCount = 0;

			request.onsuccess = () => {
				let rows = request.result;

				if (this.#whereCondition) {
					rows = rows.filter(this.#whereCondition);
				}

				const updatePromises = rows.map((row) => {
					if (isFunction(this.#updateCallback)) {
						dataToUpdate = this.#updateCallback(row);
					}

					if (!isNotEmptyObject(dataToUpdate)) {
						throw new Error('No values set for update!');
					}

					return new Promise<void>((res, rej) => {
						const updatedRow = _validateAndPrepareData<Row>(
							{ ...row, ...dataToUpdate },
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
