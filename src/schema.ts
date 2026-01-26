import { Column, Table } from './core';
import type {
	$UUID,
	ColumnDefinition,
	GenericObject,
	List,
	SchemaDefinition,
	Timestamp,
} from './types';

/**
 * Defines a Locality database schema.
 */
export function defineSchema<T extends SchemaDefinition>(schema: T): T {
	return schema;
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
	char: (length?: number) => new Column<string>(`char${length ? `(${length})` : ''}`),
	varchar: (length?: number) => new Column<number>(`varchar${length ? `(${length})` : ''}`),
	bool: () => new Column<boolean>('bool'),
	date: () => new Column<Date>('date'),
	timestamp: () => new Column<Timestamp>('timestamp'),
	object: <Obj extends GenericObject>() => new Column<Obj>(`object`),
	array: <T>() => new Column<Array<T>>(`array`),
	set: <T>() => new Column<Set<T>>(`set`),
	map: <K, V>() => new Column<Map<K, V>>(`map`),
	list: <T>() => new Column<List<T>>(`list`),
	uuid: () => new Column<$UUID>('uuid'),
	custom: <T>() => new Column<T>(`custom`),
};
