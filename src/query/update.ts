import { isFunction, isNotEmptyObject } from 'toolbox-x/guards';
import type { Table } from '../core';
import { _abortTransaction } from '../helpers';
import type {
	ColumnDefinition,
	GenericObject,
	IDBGetter,
	InferUpdateType,
	SchemaDefinition,
	UpdateCallback,
} from '../types';
import { _validateAndPrepareData } from '../validators';
import { applyUpdateRefWorkflow, getRefWorkflowTables } from './_ref';
import { BaseQuery } from './base';

/** @class Update query builder. */
export class UpdateQuery<Row extends GenericObject, T extends Table> extends BaseQuery<Row, T> {
	#keyPath?: string;

	#dataToUpdate?: InferUpdateType<T>;
	#updateCallback?: UpdateCallback<Row, T, InferUpdateType<T>>;

	constructor(
		tableName: string,
		dbGetter: IDBGetter,
		readyPromise: Promise<void>,
		columns?: ColumnDefinition,
		keyPath?: string,
		schema?: SchemaDefinition,
		transaction?: IDBTransaction
	) {
		super(tableName, dbGetter, readyPromise, transaction, schema, columns);

		this.#keyPath = keyPath;
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
	 * @instance Executes the update query
	 * @returns Number of records updated
	 */
	async run(): Promise<number> {
		await this.$readyPromise;

		const dataToUpdate = this.#dataToUpdate;

		return new Promise((resolve, reject) => {
			const tables = getRefWorkflowTables(this.$schema, this.$table, 'update');
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

			let updateCount = 0;

			request.onsuccess = () => {
				let rows = request.result;

				if (this.$whereCondition) {
					rows = rows.filter(this.$whereCondition);
				}

				const processUpdate = async () => {
					try {
						const updatePromises = rows.map(async (row) => {
							let rowDataToUpdate = dataToUpdate;

							if (isFunction(this.#updateCallback)) {
								rowDataToUpdate = this.#updateCallback(row);
							}

							if (!isNotEmptyObject(rowDataToUpdate)) {
								throw new Error('No values set for update!');
							}

							const updatedRow = _validateAndPrepareData<Row>(
								{ ...row, ...rowDataToUpdate },
								this.$columns,
								this.#keyPath,
								this.$table,
								true
							);

							await applyUpdateRefWorkflow(
								this.$schema,
								this.$table,
								row,
								updatedRow,
								trx
							);

							await new Promise<void>((res, rej) => {
								const putRequest = store.put(updatedRow);

								putRequest.onsuccess = () => {
									updateCount++;
									res();
								};

								putRequest.onerror = () => rej(putRequest.error);
							});
						});

						await Promise.all(updatePromises);
						resolve(updateCount);
					} catch (err) {
						trx.abort();
						reject(err);
					}
				};

				void processUpdate();
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
