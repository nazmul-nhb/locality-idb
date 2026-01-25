import { Column, Table } from './core';
import type { $UUID, ColumnDefinition, SchemaDefinition, Timestamp } from './types';

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
	return new Table<T>(name, columns);
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
export const col = {
	int: () => new Column<number>('int'),
	number: () => new Column<number>('number'),
	float: () => new Column<number>('float'),
	bigint: () => new Column<bigint>('bigint'),
	text: () => new Column<string>('text'),
	string: () => new Column<string>('string'),
	// char: (length?: number) => new Column<'char'>(`char${length ? `(${length})` : ''}`),
	// varchar: (length?: number) =>
	// 	new Column<'varchar'>(`varchar${length ? `(${length})` : ''}`),
	bool: () => new Column<boolean>('bool'),
	date: () => new Column<Date>('date'),
	timestamp: () => new Column<Timestamp>('timestamp'),
	// object: <Obj extends SchemaDefinition>(schema: Obj) =>
	// 	new Column<Obj>(`Object with schema ${JSON.stringify(schema)}'`),
	uuid: () => new Column<$UUID>('uuid'),
};
