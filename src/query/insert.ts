import { _abortTransaction } from '../helpers';
import { IsArray } from '../symbols';
import type { ColumnDefinition, GenericObject, IDBGetter } from '../types';
import { _validateAndPrepareData } from '../validators';

/** @class Insert query builder. */
export class InsertQuery<
	Raw extends GenericObject,
	Inserted extends Raw | Raw[],
	Data extends GenericObject,
	Return extends Inserted extends Array<infer _> ? Data[] : Data,
> {
	#table: string;
	#dbGetter: IDBGetter;
	#readyPromise: Promise<void>;
	#dataToInsert: Raw[] = [];
	#columns?: ColumnDefinition;
	// TODO: Handle multiple primary keys later
	#keyPath?: string;

	#transaction?: IDBTransaction;

	declare [IsArray]: boolean;

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

	/**
	 * @instance Sets the data to be inserted
	 * @param data Data object or array of data objects to insert
	 */
	values<T extends Inserted>(data: T) {
		this[IsArray] = Array.isArray(data);

		this.#dataToInsert = (this[IsArray] ? data : [data]) as Raw[];

		return this as InsertQuery<Raw, T, Data, T extends Array<infer _> ? Data[] : Data>;
	}

	/**
	 * @instance Executes the insert query
	 * @returns Inserted record(s)
	 */
	async run(): Promise<Return> {
		await this.#readyPromise;

		const toBeInserted = this.#dataToInsert;

		if (toBeInserted.length === 0) {
			return (this[IsArray] ? [] : {}) as Return;
		}

		return new Promise((resolve, reject) => {
			const transaction =
				this.#transaction ?? this.#dbGetter().transaction(this.#table, 'readwrite');
			const store = transaction.objectStore(this.#table);

			const insertedDocs: Data[] = [];
			const insertedKeys: IDBValidKey[] = [];
			let insertCompleted = 0;

			// Start all insert operations
			for (const data of toBeInserted) {
				const request = store.add(
					_validateAndPrepareData(data, this.#columns, this.#keyPath, this.#table)
				);

				request.onsuccess = () => {
					insertedKeys.push(request.result);
					insertCompleted++;

					// When all inserts complete, read the data back
					if (insertCompleted === toBeInserted.length) {
						if (this.#transaction) {
							// In transaction context: read from same transaction
							let readCompleted = 0;

							for (const key of insertedKeys) {
								const getRequest = store.get(key) as IDBRequest<Data>;

								getRequest.onsuccess = () => {
									insertedDocs.push(getRequest.result);
									readCompleted++;

									if (readCompleted === insertedKeys.length) {
										resolve(
											(this[IsArray]
												? insertedDocs
												: insertedDocs[0]) as Return
										);
									}
								};

								getRequest.onerror = () => reject(getRequest.error);
							}
						}
						// If not in transaction context, oncomplete handler will read the data
					}
				};

				request.onerror = () => reject(request.error);
			}

			// If not in a transaction context, wait for transaction to complete and then read
			if (!this.#transaction) {
				transaction.oncomplete = () => {
					// Retrieve all inserted documents after successful transaction
					const readTx = this.#dbGetter().transaction(this.#table, 'readonly');
					const readStore = readTx.objectStore(this.#table);

					let completed = 0;

					for (const key of insertedKeys) {
						const getRequest = readStore.get(key) as IDBRequest<Data>;

						getRequest.onsuccess = () => {
							insertedDocs.push(getRequest.result);
							completed++;

							if (completed === insertedKeys.length) {
								resolve(
									(this[IsArray] ? insertedDocs : insertedDocs[0]) as Return
								);
							}
						};

						getRequest.onerror = () => reject(getRequest.error);
					}
				};
			}

			// Handle transaction abort (happens on errors like unique constraint violations)
			transaction.onabort = () => _abortTransaction(transaction.error, reject);

			transaction.onerror = () => reject(transaction.error);
		});
	}
}
