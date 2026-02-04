import { _abortTransaction } from './helpers';
import type { StoreConfig } from './types';

/**
 * * Opens an `IndexedDB` database instance with the specified stores.
 * @param name Database name
 * @param stores Array of store configurations
 * @param version Database version (default is `1`)
 * @returns Promise that resolves to the opened {@link IDBDatabase} instance.
 */
export function openDBWithStores(
	name: string,
	stores: StoreConfig[],
	version?: number
): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (!window.indexedDB) {
			throw new Error('IndexedDB is not supported in this environment or browser!');
		}

		const request =
			isNaN(Number(version)) ?
				window.indexedDB.open(name)
			:	window.indexedDB.open(name, version);

		request.onupgradeneeded = (event) => {
			const $request = event.target as IDBOpenDBRequest;
			const db = $request.result;
			const transaction = $request.transaction;

			if (transaction) {
				for (const store of stores) {
					let objectStore: IDBObjectStore;

					// Create object store if it doesn't exist
					if (!db.objectStoreNames.contains(store.name)) {
						objectStore = db.createObjectStore(store.name, {
							keyPath: store.keyPath,
							autoIncrement: store.autoIncrement,
						});
					} else {
						// Get existing store from transaction for index updates
						objectStore = transaction.objectStore(store.name);
					}

					// Create indexes if defined
					if (store.indexes) {
						for (const index of store.indexes) {
							// Skip if index already exists
							if (!objectStore.indexNames.contains(index.name)) {
								objectStore.createIndex(index.name, index.keyPath, {
									unique: index.unique ?? false,
								});
							}
						}

						// Remove indexes that are no longer in schema
						const schemaIndexNames = new Set(store.indexes.map((idx) => idx.name));

						for (let i = 0; i < objectStore.indexNames.length; i++) {
							const existingIndexName = objectStore.indexNames.item(i);

							if (existingIndexName && !schemaIndexNames.has(existingIndexName)) {
								objectStore.deleteIndex(existingIndexName);
							}
						}
					}
				}

				transaction.onabort = () => _abortTransaction(transaction.error, reject);
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
