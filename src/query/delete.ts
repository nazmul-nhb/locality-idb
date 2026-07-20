import { isFunction, isNonEmptyString } from 'toolbox-x/guards';
import type { Table } from '../core';
import { _abortTransaction } from '../helpers';
import type {
	$InferIndex,
	$InferPrimaryKey,
	GenericObject,
	IDBGetter,
	RejectFn,
	SchemaDefinition,
	WherePredicate,
} from '../types';
import { applyDeleteRefWorkflow } from './ref';

/** @class Delete query builder. */
export class DeleteQuery<Row extends GenericObject, Key extends keyof Row, T extends Table> {
	#table: string;
	#dbGetter: IDBGetter;
	#readyPromise: Promise<void>;
	#keyField: Key;
	#whereCondition?: WherePredicate<Row>;
	#whereIndexName?: string;
	#whereIndexQuery?: IDBKeyRange | IDBValidKey;
	#schema?: SchemaDefinition;

	#trx?: IDBTransaction;

	constructor(
		table: string,
		dbGetter: IDBGetter,
		readyPromise: Promise<void>,
		keyField: Key,
		transaction?: IDBTransaction,
		schema?: SchemaDefinition
	) {
		this.#table = table;
		this.#dbGetter = dbGetter;
		this.#readyPromise = readyPromise;
		this.#keyField = keyField;
		this.#trx = transaction;
		this.#schema = schema;
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
		return isPK ? store : this.#whereIndexName ? store.index(this.#whereIndexName) : null;
	}

	/**
	 * @instance Filter rows to delete
	 * @param predicate Filtering function
	 */
	where(predicate: WherePredicate<Row>): this;

	/**
	 * @instance Filter rows to delete by index
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
	 * @instance Executes the delete query
	 * @returns Number of records deleted
	 */
	async run(): Promise<number> {
		await this.#readyPromise;

		return new Promise((resolve, reject) => {
			const trx = this.#trx ?? this.#dbGetter().transaction(this.#table, 'readwrite');
			const store = trx.objectStore(this.#table);
			let request: IDBRequest<Row[]>;

			if (this.#whereIndexName && this.#whereIndexQuery != null) {
				const source = this.#buildIndexedStore(store, reject);

				if (!source) return;

				request = source.getAll(this.#whereIndexQuery) as IDBRequest<Row[]>;
			} else {
				request = store.getAll() as IDBRequest<Row[]>;
			}

			let deleteCount = 0;

			request.onsuccess = () => {
				let rows = request.result;

				if (this.#whereCondition) {
					rows = rows.filter(this.#whereCondition);
				}

				const processDelete = async () => {
					try {
						await applyDeleteRefWorkflow(this.#schema, this.#table, rows, trx);

						const deletePromises = rows.map((row) => {
							const key = row[this.#keyField];

							return new Promise<void>((res, rej) => {
								const delRequest = store.delete(key);

								delRequest.onsuccess = () => {
									deleteCount++;
									res();
								};

								delRequest.onerror = () => rej(delRequest.error);
							});
						});

						await Promise.all(deletePromises);
						resolve(deleteCount);
					} catch (err) {
						trx.abort();
						reject(err);
					}
				};

				void processDelete();
			};

			request.onerror = () => {
				trx.abort();
				reject(request.error);
			};

			// Handle transaction abort (happens on errors)
			trx.onabort = () => _abortTransaction(trx.error, reject);
		});
	}
}
