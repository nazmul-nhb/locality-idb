import type { Table } from '../core';
import { _abortTransaction } from '../helpers';
import type { GenericObject, IDBGetter, SchemaDefinition } from '../types';
import { applyDeleteRefWorkflow, getRefWorkflowTables } from './_ref';
import { BaseQuery } from './base';

/** @class Delete query builder. */
export class DeleteQuery<
	Row extends GenericObject,
	Key extends keyof Row,
	T extends Table,
> extends BaseQuery<Row, T> {
	#primaryKey: Key;

	constructor(
		tableName: string,
		dbGetter: IDBGetter,
		readyPromise: Promise<void>,
		primaryKey: Key,
		schema?: SchemaDefinition,
		transaction?: IDBTransaction
	) {
		super(tableName, dbGetter, readyPromise, transaction, schema);

		this.#primaryKey = primaryKey;
	}

	/**
	 * @instance Executes the delete query
	 * @returns Number of records deleted
	 */
	async run(): Promise<number> {
		await this.$readyPromise;

		return new Promise((resolve, reject) => {
			const tables = getRefWorkflowTables(this.$schema, this.$table);
			const trx = this.$trx ?? this.$dbGetter().transaction(tables, 'readwrite');
			const store = trx.objectStore(this.$table);

			let request: IDBRequest<Row[]>;

			if (this.$whereIndexName && this.$whereIndexQuery != null) {
				const source = this.$buildIndexedStore(store, reject);

				if (!source) return;

				request = source.getAll(this.$whereIndexQuery) as IDBRequest<Row[]>;
			} else {
				request = store.getAll() as IDBRequest<Row[]>;
			}

			let deleteCount = 0;

			request.onsuccess = () => {
				let rows = request.result;

				if (this.$whereCondition) {
					rows = rows.filter(this.$whereCondition);
				}

				const processDelete = async () => {
					try {
						await applyDeleteRefWorkflow(this.$schema, this.$table, rows, trx);

						const deletePromises = rows.map((row) => {
							const key = row[this.#primaryKey];

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
