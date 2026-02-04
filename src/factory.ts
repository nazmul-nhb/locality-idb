import { isNumber } from 'nhb-toolbox';
import { _abortTransaction, _ensureIndexedDB } from './helpers';
import type { StoreConfig } from './types';

/**
 * * Opens an `IndexedDB` database instance with the specified stores.
 * @param name Database name
 * @param stores Array of store configurations
 * @param version Database version (default is `undefined`)
 * @returns Promise that resolves to the opened {@link IDBDatabase} instance.
 */
export function openDBWithStores(
	name: string,
	stores: StoreConfig[],
	version?: number
): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		_ensureIndexedDB();

		const request = window.indexedDB.open(name, isNumber(version) ? version : undefined);

		request.onupgradeneeded = (event) => {
			const $request = event.target as IDBOpenDBRequest;
			const db = $request.result;
			const transaction = $request.transaction;

			if (transaction) {
				const schemaStoreNames = new Set(stores.map((store) => store.name));

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

					const schemaIndexNames = new Set(
						store.indexes ? store.indexes.map((idx) => idx.name) : []
					);

					// Create or update indexes
					for (const index of store.indexes ?? []) {
						// Skip if index already exists
						if (!objectStore.indexNames.contains(index.name)) {
							objectStore.createIndex(index.name, index.keyPath, {
								unique: index.unique ?? false,
							});
						}
					}

					// Remove indexes that are no longer in schema
					for (let i = 0; i < objectStore.indexNames.length; i++) {
						const existingIndexName = objectStore.indexNames.item(i);

						if (existingIndexName && !schemaIndexNames.has(existingIndexName)) {
							objectStore.deleteIndex(existingIndexName);
						}
					}
				}

				// Remove object stores that are no longer in schema
				for (const existingStore of Array.from(db.objectStoreNames)) {
					if (!schemaStoreNames.has(existingStore)) {
						db.deleteObjectStore(existingStore);
					}
				}

				transaction.onabort = () => _abortTransaction(transaction.error, reject);
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
