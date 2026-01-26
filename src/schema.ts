import { isPositiveInteger as isPositive } from 'nhb-toolbox';
import { Column, Table } from './core';
import type { $UUID, ColumnDefinition, GenericObject, List, Timestamp, Tuple } from './types';

/**
 * Defines a Locality database schema.
 */
export function defineSchema<T extends Record<string, ColumnDefinition>, Keys extends keyof T>(
	schema: T
): { [K in Keys]: Table<T[K]> } {
	const result = {} as { [K in Keys]: Table<T[K]> };

	for (const [tableName, columns] of Object.entries(schema)) {
		result[tableName as Keys] = new Table(tableName, columns) as Table<T[Keys]>;
	}

	return result;
}

/**
 * Creates a table schema.
 */
export function table<T extends ColumnDefinition>(name: string, columns: T) {
	return new Table(name, columns);
}

// export const col = {
// 	int: () => new Column<number>('int'),
// 	text: () => new Column<string>('text'),
// 	bool: () => new Column<boolean>('bool'),
// 	date: () => new Column<Date>('date'),
// };

/**
 * Column builders
 */
export const column = {
	int: () => new Column<number>('int'),
	number: () => new Column<number>('number'),
	float: () => new Column<number>('float'),
	bigint: () => new Column<bigint>('bigint'),
	text: () => new Column<string>('text'),
	string: () => new Column<string>('string'),
	char: (l?: number) => new Column<string>(`char(${isPositive(l) ? l : ''})`),
	varchar: (l?: number) => new Column<number>(`varchar(${isPositive(l) ? l : ''})`),
	uuid: () => new Column<$UUID>('uuid'),
	bool: () => new Column<boolean>('bool'),
	date: () => new Column<Date>('date'),
	timestamp: () => new Column<Timestamp>('timestamp'),
	object: <Obj extends GenericObject>() => new Column<Obj>(`object`),
	array: <T>() => new Column<Array<T>>(`array`),
	list: <T>() => new Column<List<T>>(`list`),
	tuple: <T>() => new Column<Tuple<T>>(`tuple`),
	set: <T>() => new Column<Set<T>>(`set`),
	map: <K, V>() => new Column<Map<K, V>>(`map`),
	custom: <T>() => new Column<T>(`custom`),
};
