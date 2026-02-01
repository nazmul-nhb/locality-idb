import { Column, Table } from './core';
import type {
	$UUID,
	ColumnDefinition,
	ColumnRecord,
	GenericObject,
	List,
	Numeric,
	SchemaRecord,
	Timestamp,
	Tuple,
} from './types';

/**
 * * Defines a database schema from a given schema definition.
 * @param schema An object defining the schema, where each key is a table name and each value is a record of {@link column} definitions.
 * @returns An object mapping each table name to its corresponding {@link Table} instance.
 *
 * @example
 * const schema = defineSchema({
 *   users: {
 *     id: column.int().pk().auto(),
 *     name: column.varchar(255).unique(),
 *     createdAt: column.timestamp(),
 *     isActive: column.bool().default(true),
 *   },
 *   posts: {
 *     id: column.int().pk().auto(),
 *     userId: column.int().index(),
 *     title: column.varchar(255),
 *     content: column.text(),
 *     createdAt: column.timestamp(),
 *   },
 * });
 *
 * // Infer types:
 *
 * type User = InferSelectType<typeof schema.users>;
 * type InsertUser = InferInsertType<typeof schema.users>;
 * type UpdateUser = InferUpdateType<typeof schema.users>;
 *
 * type Post = InferSelectType<typeof schema.posts>;
 * type InsertPost = InferInsertType<typeof schema.posts>;
 * type UpdatePost = InferUpdateType<typeof schema.posts>;
 */
export function defineSchema<Schema extends ColumnRecord, Keys extends keyof Schema>(
	schema: Schema
): SchemaRecord<Schema, Keys> {
	const result = {} as SchemaRecord<Schema, Keys>;

	for (const [tableName, columns] of Object.entries(schema)) {
		result[tableName as Keys] = new Table(tableName, columns) as Table<Schema[Keys]>;
	}

	return result;
}

/**
 * * Factory function to create a new {@link Table} instance.
 * @param name The name of the table.
 * @param columns An object defining the columns of the table using {@link column} definitions.
 * @returns A new {@link Table} instance representing the table schema.
 *
 * @example
 * const userTable = table('users', {
 *   id: column.int().pk().auto(),
 *   name: column.varchar(255).unique(),
 *   createdAt: column.timestamp(),
 *   isActive: column.bool().default(true),
 * });
 */
export function table<T extends ColumnDefinition>(name: string, columns: T) {
	return new Table(name, columns);
}

/**
 * * Column factory with various column types.
 *
 * @remarks
 * - `char` and `varchar` accept an optional length parameter.
 * - `object`, `array`, `list`, `tuple`, `set`, and `map` are generic and can be typed.
 * - `custom` can be used for any custom data type.
 * - Each column can be further configured using methods like `pk()`, `unique()`, `auto()`, `index()`, `default()`, and `optional()`.
 * - Example usage is provided below:
 *
 * @example
 * const idColumn = column.int().pk().auto();
 * const nameColumn = column.varchar(255).unique();
 * const createdAtColumn = column.timestamp();
 * const isActiveColumn = column.bool().default(true);
 *
 * // Define a table schema
 * const userTable = table('users', {
 *   id: idColumn,
 *   name: nameColumn,
 *   createdAt: createdAtColumn,
 *   isActive: isActiveColumn,
 * });
 *
 * // Define a database schema
 * const schema = defineSchema({
 *   users: {
 *       id: idColumn,
 *       name: nameColumn,
 *       createdAt: createdAtColumn,
 *       isActive: isActiveColumn,
 *   },
 * });
 */
export const column = {
	/**
	 * Creates an integer column.
	 * @returns A new {@link Column} instance for integers.
	 * @remarks  column type is typically used for whole numbers.
	 */
	int: () => new Column<number, 'int'>('int'),
	/**
	 * Creates a float column.
	 * @returns A new {@link Column} instance for floating-point numbers.
	 * @remarks This column type is specifically for decimal numbers.
	 */
	float: () => new Column<number, 'float'>('float'),
	/**
	 * Creates a number column.
	 * @returns A new {@link Column} instance for numbers.
	 * @remarks This column type is used for both whole & floating-point numbers.
	 */
	number: () => new Column<number, 'number'>('number'),
	/**
	 * Creates a numeric (number or numeric string) column.
	 * @returns A new {@link Column} instance for numeric.
	 * @remarks This column type is used for both whole & floating-point numbers or numeric strings.
	 */
	numeric: () => new Column<Numeric, 'numeric'>('numeric'),
	/**
	 * Creates a bigint column.
	 * @returns A new {@link Column} instance for bigints.
	 * @remarks This column type is used for large integers beyond the safe integer limit of JavaScript.
	 */
	bigint: () => new Column<bigint, 'bigint'>('bigint'),
	/**
	 * Creates a text column.
	 * @returns A new {@link Column} instance for text.
	 * @remarks This column type is used for large strings of text.
	 */
	text: () => new Column<string, 'text'>('text'),
	/**
	 * Creates a string column.
	 * @returns A new {@link Column} instance for strings.
	 * @remarks This column type is used for general string data.
	 */
	string: () => new Column<string, 'string'>('string'),
	/**
	 * Creates a char column with optional length.
	 * @param length Optional length of the char column. Defaults to `8`.
	 * @returns A new {@link Column} instance for char.
	 * @remarks This column type is used for fixed-length strings.
	 */
	char: <L extends number = 8>(length = 8 as L) =>
		new Column<string, `char(${L})`>(`char(${length})`),
	/**
	 * Creates a varchar column with optional length.
	 * @param length Optional length of the varchar column. Defaults to `32`.
	 * @returns A new {@link Column} instance for varchar.
	 * @remarks This column type is used for variable-length strings.
	 */
	varchar: <L extends number = 32>(length = 32 as L) =>
		new Column<string, `varchar(${L})`>(`varchar(${length})`),
	/**
	 * Creates a UUID column.
	 * @returns A new {@link Column} instance for UUIDs.
	 * @remarks
	 * - This column type is used for storing UUID strings.
	 * - UUIDs are typically used as unique identifiers.
	 * - Automatically generates UUID v4 values when no value is provided.
	 */
	uuid: () => new Column<$UUID, 'uuid'>('uuid'),
	/**
	 * Creates a timestamp column.
	 * @returns A new {@link Column} instance for timestamps.
	 * @remarks
	 * - This column type is used for storing date and time information in ISO 8601 format.
	 * - Automatically generates the current timestamp when no value is provided.
	 */
	timestamp: () => new Column<Timestamp, 'timestamp'>('timestamp'),
	/**
	 * Creates a boolean column. Same as {@link column.boolean boolean}.
	 * @returns A new {@link Column} instance for booleans.
	 * @remarks This column type is used for true/false values.
	 */
	bool: () => new Column<boolean, 'bool'>('bool'),
	/**
	 * Creates a boolean column. Same as {@link column.bool bool}.
	 * @returns A new {@link Column} instance for booleans.
	 * @remarks This column type is used for true/false values.
	 */
	boolean: () => new Column<boolean, 'boolean'>('boolean'),
	/**
	 * Creates a date column.
	 * @returns A new {@link Column} instance for dates.
	 * @remarks This column type is used for storing date values.
	 */
	date: () => new Column<Date, 'date'>('date'),
	/**
	 * Creates an object column.
	 * @returns A new {@link Column} instance for objects.
	 * @remarks This column type is used for storing generic objects with string keys.
	 */
	object: <Obj extends GenericObject>() => new Column<Obj, `object`>(`object`),
	/**
	 * Creates an array column.
	 * @returns A new {@link Column} instance for arrays.
	 * @remarks This column type is used for storing arrays of any type.
	 */
	array: <T = any>() => new Column<Array<T>, `array`>(`array`),
	/**
	 * Creates a list column.
	 * @returns A new {@link Column} instance for lists.
	 * @remarks This column type is used for storing lists of any type.
	 */
	list: <T = any>() => new Column<List<T>, `list`>(`list`),
	/**
	 * Creates a tuple column.
	 * @returns A new {@link Column} instance for tuples.
	 * @remarks This column type is used for storing fixed-size arrays (tuples) of any type.
	 */
	tuple: <T = any>() => new Column<Tuple<T>, `tuple`>(`tuple`),
	/**
	 * Creates a set column.
	 * @returns A new {@link Column} instance for sets.
	 * @remarks This column type is used for storing unique collections of any type.
	 */
	set: <T = any>() => new Column<Set<T>, `set`>(`set`),
	/**
	 * Creates a map column.
	 * @returns A new {@link Column} instance for maps.
	 * @remarks This column type is used for storing key-value pairs of any type.
	 */
	map: <K = any, V = any>() => new Column<Map<K, V>, `map`>(`map`),
	/**
	 * Creates a custom column.
	 * @returns A new {@link Column} instance for custom data types.
	 * @remarks
	 * - This column type is used for any custom data type.
	 * - You can specify the type when creating the column.
	 * - No built-in serialization/deserialization is provided; you must handle it yourself.
	 */
	custom: <T = any>() => new Column<T, `custom`>(`custom`),
} as const;
