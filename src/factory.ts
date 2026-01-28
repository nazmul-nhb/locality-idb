import type { StoreConfig } from './types';

/**
 * * Opens an `IndexedDB` database with the specified stores.
 * @param name Database name
 * @param stores Array of store configurations
 * @param version Database version (default is `1`)
 * @returns Promise that resolves to the opened {@link IDBDatabase} instance.
 */
export function openDBWithStores(
	name: string,
	stores: StoreConfig[],
	version = 1
): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (!window.indexedDB) {
			throw new Error('IndexedDb is not supported in this environment or browser!');
		}

		const request = window.indexedDB.open(name, version);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			for (const store of stores) {
				if (!db.objectStoreNames.contains(store.name)) {
					db.createObjectStore(store.name, {
						keyPath: store.keyPath,
						autoIncrement: store.autoIncrement,
					});
				}
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
