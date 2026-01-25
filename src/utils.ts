import type { StoreConfig } from './types';

export function openDBWithStores(
	name: string,
	version: number,
	stores: StoreConfig[]
): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(name, version);

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
