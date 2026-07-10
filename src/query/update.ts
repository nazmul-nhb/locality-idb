import { isFunction, isNonEmptyString, isNotEmptyObject, isUndefined } from 'toolbox-x/guards';
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
	WherePredicate,
} from '../types';
import { _validateAndPrepareData } from '../validators';

/** @class Update query builder. */
export class UpdateQuery<T extends GenericObject, S extends Table> {
	#table: string;
	#dbGetter: IDBGetter;
	#readyPromise: Promise<void>;
	#dataToUpdate?: InferUpdateType<S>;
	#whereCondition?: WherePredicate<T>;
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
	set(values: InferUpdateType<S>) {
		this.#dataToUpdate = values;
		return this;
	}

	/**
	 * @instance Filter rows to update
	 * @param predicate Filtering function
	 */
	where(predicate: WherePredicate<T>): this;

	/**
	 * @instance Filter rows to update by index
	 * @param indexName Index name to query
	 * @param query Key value or {@link IDBKeyRange} to search for
	 */
	where<IdxKey extends $InferPrimaryKey<S['columns']> | $InferIndex<S['columns']>>(
		indexName: IdxKey,
		query: IDBKeyRange | T[IdxKey]
	): this;

	where<IdxKey extends $InferPrimaryKey<S['columns']> | $InferIndex<S['columns']>>(
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

			let request: IDBRequest<T[]>;

			if (this.#whereIndexName && !isUndefined(this.#whereIndexQuery)) {
				const source = this.#buildIndexedStore(store, reject);

				if (!source) return;

				request = source.getAll(this.#whereIndexQuery) as IDBRequest<T[]>;
			} else {
				request = store.getAll() as IDBRequest<T[]>;
			}

			let updateCount = 0;

			request.onsuccess = () => {
				let rows = request.result;

				if (this.#whereCondition) {
					rows = rows.filter(this.#whereCondition);
				}

				const updatePromises = rows.map((row) => {
					return new Promise<void>((res, rej) => {
						const updatedRow = _validateAndPrepareData<T>(
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
