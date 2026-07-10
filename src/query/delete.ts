import { isFunction, isNonEmptyString, isUndefined } from 'toolbox-x/guards';
import type { Table } from '../core';
import { _abortTransaction } from '../helpers';
import type {
	$InferIndex,
	$InferPrimaryKey,
	GenericObject,
	IDBGetter,
	RejectFn,
	WherePredicate,
} from '../types';

/** @class Delete query builder. */
export class DeleteQuery<T extends GenericObject, Key extends keyof T, S extends Table> {
	#table: string;
	#dbGetter: IDBGetter;
	#readyPromise: Promise<void>;
	#keyField: Key;
	#whereCondition?: WherePredicate<T>;
	#whereIndexName?: string;
	#whereIndexQuery?: IDBKeyRange | IDBValidKey;

	#transaction?: IDBTransaction;

	constructor(
		table: string,
		dbGetter: IDBGetter,
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
	 * @instance Filter rows to delete
	 * @param predicate Filtering function
	 */
	where(predicate: WherePredicate<T>): this;

	/**
	 * @instance Filter rows to delete by index
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
	 * @instance Executes the delete query
	 * @returns Number of records deleted
	 */
	async run(): Promise<number> {
		await this.#readyPromise;
		return new Promise((resolve, reject) => {
			const transaction =
				this.#transaction ?? this.#dbGetter().transaction(this.#table, 'readwrite');
			const store = transaction.objectStore(this.#table);
			let request: IDBRequest<T[]> | IDBRequest<IDBValidKey[]>;
			let useKeysOnly = false;

			if (this.#whereIndexName && !isUndefined(this.#whereIndexQuery)) {
				const source = this.#buildIndexedStore(store, reject);

				if (!source) return;

				if (this.#whereCondition) {
					request = source.getAll(this.#whereIndexQuery) as IDBRequest<T[]>;
				} else {
					useKeysOnly = true;
					request = source.getAllKeys(this.#whereIndexQuery);
				}
			} else {
				request = store.getAll() as IDBRequest<T[]>;
			}

			let deleteCount = 0;

			request.onsuccess = () => {
				const results = request.result;
				let keys: IDBValidKey[] = [];

				if (useKeysOnly) {
					keys = results as IDBValidKey[];
				} else {
					let rows = results as T[];

					if (this.#whereCondition) {
						rows = rows.filter(this.#whereCondition);
					}

					keys = rows.map((row) => row[this.#keyField]);
				}

				const deletePromises = keys.map((key) => {
					return new Promise<void>((res, rej) => {
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
