import type { Tone } from './main';

export const code = (lines: string[]) => lines.join('\n');

export function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export function getValueOf(id: string) {
	return document.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '';
}

export function requiredElement<T extends Element>(selector: string): T {
	const element = document.querySelector<T>(selector);
	if (!element) throw new Error(`Expected ${selector} to exist.`);
	return element;
}

export function escapeHtml(value: string) {
	return value.replace(
		/[&<>'"]/g,
		(char) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ??
			char
	);
}

export function json(value: unknown) {
	return JSON.stringify(
		value,
		(_key, item) => (typeof item === 'bigint' ? `${item}n` : item),
		2
	);
}

export function fileIcon(name: string) {
	return name.endsWith('.test.ts') ? '◉' : '◆';
}

export function showToast(tone: Tone, message: string) {
	const toast = document.createElement('div');
	toast.className = `toast ${tone}`;
	toast.textContent = message;
	requiredElement('#toastRegion').append(toast);
	setTimeout(() => toast.remove(), 4600);
}
