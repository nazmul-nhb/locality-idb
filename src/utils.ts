import { clampNumber } from 'toolbox-x';
import {
	isFunction,
	isNonEmptyString,
	isNumber,
	isValidEmail,
	isValidURL,
	isUUID as isValidUUID,
} from 'toolbox-x/guards';
import { _ensureIndexedDB, _formatUUID, _getDBList, _toString } from './helpers';
import type {
	Email,
	FormatByte,
	StorageUsage,
	Timestamp,
	URLString,
	UUID,
	UUIDVersion,
} from './types';

/**
 * * Generate a random UUID v4 string
 * @param uppercase Whether to return the UUID in uppercase format. Default is `false`.
 * @returns UUID v4 string
 * @remarks Uses Web Crypto (`crypto.randomUUID` or `crypto.getRandomValues`) when available, falls back to `Math.random()`.
 */
export function uuidV4(uppercase = false): UUID<'v4'> {
	if (crypto?.randomUUID) {
		return crypto.randomUUID() as UUID<'v4'>;
	}

	const bytes = new Uint8Array(16);

	if (crypto?.getRandomValues) {
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
 * @returns Timestamp string in ISO 8601 format
 */
export function getTimestamp(value?: string | number | Date): Timestamp {
	let date =
		value instanceof Date
			? value
			: new Date(
					isNonEmptyString(value) ? value.replace(/['"]/g, '') : (value ?? Date.now())
				);

	if (Number.isNaN(date.getTime())) {
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

/**
 * * Get the storage usage & quota of the browser's {@link https://developer.mozilla.org/docs/Web/API/StorageManager available storage}.
 *
 * @template T The type of the formatted values (default is `number`).
 * @param formatter Optional function to format the byte values (e.g., to convert to KB, MB, etc.).
 * @returns A promise that resolves to an object containing the `quota` and `used` storage values.
 *
 * @remarks This function uses the {@link https://developer.mozilla.org/docs/Web/API/StorageManager/estimate navigator.storage.estimate()} API to retrieve storage information.
 * - If the API is not available or an error occurs, it returns default values of `0` for both `quota` and `used`.
 * - The `formatter` function can be used to convert the byte values into a more readable format.
 * - If no formatter is provided, the raw byte values will be returned.
 *
 * @example
 * ```ts
 * const storage = await getStorageUsage(formatBytes);
 * console.log(`Quota: ${storage.quota}, Used: ${storage.used}`);
 * ```
 * @example
 * ```ts
 * const storage = await getStorageUsage();
 * console.log(`Quota: ${storage.quota}, Used: ${storage.used}`);
 * ```
 */
export async function getStorageUsage<T = number>(
	formatter?: FormatByte<T>
): Promise<StorageUsage<T>> {
	const usage = { quota: 0, used: 0 } as StorageUsage<T>;

	const _useFormatter = (value: number) => {
		return isFunction(formatter) ? formatter(value) : (value as T);
	};

	try {
		if (navigator && 'storage' in navigator && 'estimate' in navigator.storage) {
			const estimate = await navigator.storage.estimate();

			usage.quota = _useFormatter(estimate.quota ?? 0);
			usage.used = _useFormatter(estimate.usage ?? 0);
		}
	} catch {
		return usage;
	}

	return usage;
}

/**
 * * Format a byte value into a human-readable string with appropriate units (B, KB, MB, GB).
 *
 * @param bytes The byte value to format.
 * @returns A formatted string representing the byte value in appropriate units.
 *
 * @remarks This function uses logarithmic calculations to determine the appropriate unit for the given byte value.
 * - If the byte value is `0`, it returns `'0 B'`.
 * - The function supports formatting up to gigabytes (GB).
 * - The formatted value is rounded to two decimal places.
 * - If the input is not a finite number, it throws a `TypeError`.
 *
 * @example
 * ```ts
 * console.log(formatBytes(1024)); // "1.00 KB"
 * console.log(formatBytes(1048576)); // "1.00 MB"
 * console.log(formatBytes(1073741824)); // "1.00 GB"
 * console.log(formatBytes(0)); // "0 B"
 * ```
 */
export function formatBytes(bytes: number): string {
	if (!isNumber(bytes)) {
		throw new TypeError(
			`Expected a finite number for bytes, but received ${_toString(bytes)} of type ${typeof bytes}`
		);
	}

	if (bytes === 0) return '0 B';

	const units = ['B', 'KB', 'MB', 'GB'];

	const i = clampNumber(Math.floor(Math.log(bytes) / Math.log(1024)), 0, units.length - 1);

	return `${(bytes / 1024 ** i).toFixed(2)} ${units[i]}`;
}
