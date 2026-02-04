import { isNonEmptyString, isValidEmail, isValidURL, isUUID as isValidUUID } from 'nhb-toolbox';
import { _ensureIndexedDB, _formatUUID, _getDBList } from './helpers';
import type { Email, Timestamp, URLString, UUID, UUIDVersion } from './types';

/**
 * * Generate a random UUID v4 string
 * @param uppercase Whether to return the UUID in uppercase format. Default is `false`.
 * @returns UUID v4 string
 * @remarks Uses Web Crypto (`crypto.randomUUID` or `crypto.getRandomValues`) when available, falls back to `Math.random()`.
 */
export function uuidV4(uppercase = false): UUID<'v4'> {
	if (crypto.randomUUID) {
		return crypto.randomUUID() as UUID<'v4'>;
	}

	const bytes = new Uint8Array(16);

	if (crypto.getRandomValues) {
		crypto.getRandomValues(bytes);
	} else {
		for (let i = 0; i < 16; i++) {
			bytes[i] = Math.floor(Math.random() * 256);
		}
	}

	let hex = '';
	for (let i = 0; i < 16; i++) {
		hex += bytes[i].toString(16).padStart(2, '0');
	}

	return _formatUUID(hex, 4, uppercase);
}

/**
 * * Get current timestamp in ISO 8601 format
 * @param value Optional date input (string, number, or Date object). Defaults to {@link Date new Date()}
 * @remarks If the provided value is invalid, the current date and time will be used.
 * @return Timestamp string in ISO 8601 format
 */
export function getTimestamp(value?: string | number | Date): Timestamp {
	let date =
		value instanceof Date ? value : (
			new Date(
				isNonEmptyString(value) ? value.replace(/['"]/g, '') : (value ?? Date.now())
			)
		);

	if (isNaN(date.getTime())) {
		date = new Date();
	}

	return date.toISOString() as Timestamp;
}

/**
 * * Check if a value is a valid Timestamp string in ISO 8601 format
 * @param value The value to check
 * @returns `true` if the value is a valid Timestamp, otherwise `false`
 */
export function isTimestamp(value: unknown): value is Timestamp {
	return (
		isNonEmptyString(value) &&
		value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/) !==
			null
	);
}

/**
 * * Delete an IndexedDB database by name
 * @param name The name of the database to delete
 * @returns A promise that resolves when the database is deleted
 * @throws Error if `IndexedDB` is not supported or if the database does not exist
 */
export async function deleteDB(name: string): Promise<void> {
	_ensureIndexedDB();

	const dbList = await _getDBList();
	const dbExists = dbList.some((db) => db.name === name);

	if (!dbExists) {
		throw new Error(`Database '${name}' does not exist in this system!`);
	}

	return new Promise((resolve, reject) => {
		const request = window.indexedDB.deleteDatabase(name);

		request.onsuccess = () => resolve();

		request.onerror = () => reject(request.error);

		request.onblocked = () =>
			reject(new Error(`Delete operation is blocked for database '${name}'`));
	});
}

/**
 * * Check if a value is a valid Email string
 * @param value The value to check
 * @returns `true` if the value is a valid Email, otherwise `false`
 */
export function isEmail(value: unknown): value is Email {
	return isValidEmail(value);
}

/**
 * * Check if a value is a valid URL string
 * @param value The value to check
 * @returns `true` if the value is a valid URL, otherwise `false`
 */
export function isURL(value: unknown): value is URLString {
	return isValidURL(value);
}

/**
 * * Check if a value is a valid UUID (`RFC4122` `v1`-`v8`).
 * @param value - The value to check.
 * @returns `true` if the value matches standard UUID pattern, otherwise `false`.
 */
export function isUUID(value: unknown): value is UUID<UUIDVersion> {
	return isValidUUID(value);
}
