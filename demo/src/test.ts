import { validateColumnType } from 'locality-idb';

// console.info(
// 	Object.values(column).map((col) => {
// 		const colStr = col.toString();

// 		const match = colStr.match(/Column\((.+)\)/);
// 		const typeStr = match ? match[1] : 'unknown';

// 		return typeStr.replace(/"|`/g, '');
// 	})
// );

console.info(validateColumnType('float', '44'));
