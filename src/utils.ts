import { isNonEmptyString } from 'nhb-toolbox';
import { _formatUUID } from './helpers';
import type { Timestamp, UUID } from './types';

/**
 * * Generate a random UUID v4 string
 * @param uppercase Whether to return the UUID in uppercase format. Default is `false`.
 * @returns UUID v4 string
 */
export function uuidV4(uppercase = false): UUID<'v4'> {
	const bytes = new Uint8Array(16);

	for (let i = 0; i < 16; i++) {
		bytes[i] = Math.floor(Math.random() * 256);
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
				isNonEmptyString(value) ? value.replace(/['"]/g, '') : (value ?? new Date())
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
		value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/) !== null
	);
}

export function deleteDB(name: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!window.indexedDB) {
			throw new Error('IndexedDb is not supported in this environment or browser!');
		}

		const request = window.indexedDB.deleteDatabase(name);

		request.onsuccess = () => {
			resolve();
		};

		request.onerror = () => {
			reject(request.error);
		};

		request.onblocked = () => {
			reject(new Error(`Delete blocked for database '${name}'`));
		};
	});
}
