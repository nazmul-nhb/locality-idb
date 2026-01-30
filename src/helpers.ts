import type { RejectFn, UUID, UUIDVersion } from './types';

/** Ensure UUID variant is RFC4122 compliant */
function _hexVariant(hex: string): string {
	const v = parseInt(hex, 16);
	return ((v & 0x3f) | 0x80).toString(16).padStart(2, '0');
}

/** Convert a hex string to UUID format */
export function _formatUUID<V extends UUIDVersion>(h: string, v: number, up: boolean): UUID<V> {
	// replace the first nibble of the 3rd group with the version digit
	const part3 = String(v) + h.slice(13, 16); // positions 12 replaced by version; keep 13..15
	// adjust byte at positions 16..17 (2 hex chars) and combine with positions 18..19
	const part4 = _hexVariant(h.slice(16, 18)) + h.slice(18, 20);

	const formatted = [h.slice(0, 8), h.slice(8, 12), part3, part4, h.slice(20, 32)].join('-');

	return (up ? formatted.toUpperCase() : formatted) as UUID<V>;
}

export function _abortTransaction(error: DOMException | null, reject: RejectFn) {
	reject(error || new Error('IndexedDB transaction was aborted!'));
}
