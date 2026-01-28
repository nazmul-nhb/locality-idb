import { _formatUUID } from './helpers';
import type { Timestamp, UUID } from './types';

export function uuidV4(uppercase = false): UUID<'v4'> {
	const bytes = new Uint8Array(16);

	for (let i = 0; i < 16; i++) {
		bytes[i] = Math.floor(Math.random() * 256);
	}

	// Convert to hex
	let hex = '';
	for (let i = 0; i < 16; i++) {
		hex += bytes[i].toString(16).padStart(2, '0');
	}

	return _formatUUID(hex, 4, uppercase);
}

export function getTimestamp(date = new Date()): Timestamp {
	return date.toISOString() as Timestamp;
}
