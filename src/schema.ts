import { Column, Table } from './core';
import type {
	$UUID,
	ColumnDefinition,
	ColumnRecord,
	Email,
	GenericObject,
	List,
	Numeric,
	Timestamp,
	Tuple,
	URLString,
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
export function defineSchema<Schema>(schema: Schema): {
	[K in keyof Schema]: Table<Extract<Schema[K], ColumnDefinition>>;
} {
	const result = {} as { [K in keyof Schema]: Table<Extract<Schema[K], ColumnDefinition>> };

	for (const [tableName, columns] of Object.entries(schema as ColumnRecord)) {
		result[tableName as keyof Schema] = new Table(
			tableName,
			columns as Extract<Schema[keyof Schema], ColumnDefinition>
		);
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
	 * @remarks
	 * - Accepts an optional generic type parameter to create branded or restricted integer types.
	 * - The type parameter must extend `number` and defaults to `number` if not specified.
	 * - Useful for creating type-safe identifiers, status codes, or domain-specific integer types.
	 *
	 * @example
	 * // Basic usage
	 * const age = column.int();
	 *
	 * // With branded type for type safety
	 * type UserId = Branded<number, 'UserId'>;
	 * const userId = column.int<UserId>();
	 */
	int: <T extends number = number>() => new Column<T, 'int'>('int'),
	/**
	 * Creates a float column.
	 * @returns A new {@link Column} instance for floating-point numbers.
	 * @remarks
	 * - Accepts an optional generic type parameter to create branded or restricted floating-point types.
	 * - The type parameter must extend `number` and defaults to `number` if not specified.
	 * - Ideal for monetary values, measurements, or any decimal number requiring type safety.
	 *
	 * @example
	 * // Basic usage
	 * const price = column.float();
	 *
	 * // With branded type for currency safety
	 * type USD = Branded<number, 'USD'>;
	 * const amount = column.float<USD>();
	 */
	float: <T extends number = number>() => new Column<T, 'float'>('float'),
	/**
	 * Creates a number column.
	 * @returns A new {@link Column} instance for numbers.
	 * @remarks
	 * - Accepts both integers and floating-point numbers.
	 * - Accepts an optional generic type parameter to create branded or restricted numeric types.
	 * - The type parameter must extend `number` and defaults to `number` if not specified.
	 * - Use this when you need flexibility between integer and decimal values.
	 *
	 * @example
	 * // Basic usage
	 * const score = column.number();
	 *
	 * // With branded type
	 * type Percentage = Branded<number, 'Percentage'>;
	 * const completion = column.number<Percentage>();
	 */
	number: <T extends number = number>() => new Column<T, 'number'>('number'),
	/**
	 * Creates a numeric (number or numeric string) column.
	 * @returns A new {@link Column} instance for numeric.
	 * @remarks
	 * - Accepts both `number` values and numeric strings (e.g., `"123"`, `"45.67"`).
	 * - Accepts an optional generic type parameter that must extend `Numeric` (union of `number | \`${number}\``).
	 * - Defaults to `Numeric` if not specified.
	 * - Useful for data that may come from external sources in string format but represents numbers.
	 *
	 * @example
	 * // Basic usage - accepts 123 or "123"
	 * const amount = column.numeric();
	 *
	 * // With restricted branded type
	 * type SerialNumber = Branded<Numeric, 'SerialNumber'>;
	 * const serial = column.numeric<SerialNumber>();
	 */
	numeric: <T extends Numeric = Numeric>() => new Column<T, 'numeric'>('numeric'),
	/**
	 * Creates a bigint column.
	 * @returns A new {@link Column} instance for bigints.
	 * @remarks
	 * - Used for storing integers beyond JavaScript's safe integer limit (`Number.MAX_SAFE_INTEGER`).
	 * - Accepts an optional generic type parameter that must extend `Numeric`.
	 * - Defaults to `Numeric` if not specified.
	 * - Essential for handling very large integer values such as database IDs, timestamps in milliseconds, or financial calculations.
	 *
	 * @example
	 * // Basic usage
	 * const largeId = column.bigint();
	 *
	 * // With branded type for Twitter-style snowflake IDs
	 * type SnowflakeId = Branded<bigint, 'SnowflakeId'>;
	 * const snowflake = column.bigint<SnowflakeId>();
	 */
	bigint: <T extends Numeric = Numeric>() => new Column<T, 'bigint'>('bigint'),
	/**
	 * Creates a text column.
	 * @returns A new {@link Column} instance for text.
	 * @remarks
	 * - Designed for storing large or unlimited-length text content.
	 * - Accepts an optional generic type parameter to create branded or literal string types.
	 * - The type parameter must extend `string` and defaults to `string` if not specified.
	 * - Ideal for descriptions, content bodies, or any variable-length text data.
	 *
	 * @example
	 * // Basic usage
	 * const description = column.text();
	 *
	 * // With literal union for restricted values
	 * type Status = 'draft' | 'published' | 'archived';
	 * const status = column.text<Status>();
	 *
	 * // With branded type
	 * type HTML = Branded<string, 'HTML'>;
	 * const content = column.text<HTML>();
	 */
	text: <T extends string = string>() => new Column<T, 'text'>('text'),
	/**
	 * Creates a string column.
	 * @returns A new {@link Column} instance for strings.
	 * @remarks
	 * - General-purpose column type for string data of any length.
	 * - Accepts an optional generic type parameter to create branded or literal string types.
	 * - The type parameter must extend `string` and defaults to `string` if not specified.
	 * - Functionally similar to `text()` but semantically used for general string fields.
	 *
	 * @example
	 * // Basic usage
	 * const name = column.string();
	 *
	 * // With literal union for enum-like behavior
	 * type Role = 'admin' | 'user' | 'guest';
	 * const role = column.string<Role>();
	 *
	 * // With branded type for URLs
	 * type URL = Branded<string, 'URL'>;
	 * const website = column.string<URL>();
	 */
	string: <T extends string = string>() => new Column<T, 'string'>('string'),
	/**
	 * Creates a char column with optional length.
	 * @param length Optional length of the char column. Defaults to `8`.
	 * @returns A new {@link Column} instance for char.
	 * @remarks
	 * - Designed for fixed-length string data where all values have the same character count.
	 * - Accepts an optional generic type parameter to create branded or literal string types.
	 * - The type parameter must extend `string` and defaults to `string` if not specified.
	 * - Runtime validation enforces exact length matching.
	 * - Common use cases include country codes, state abbreviations, or fixed-format identifiers.
	 *
	 * @example
	 * // Basic usage with default length (8)
	 * const code = column.char();
	 *
	 * // With specific length for country codes
	 * const country = column.char(2); // "US", "UK", etc.
	 *
	 * // With branded type
	 * type StateCode = Branded<string, 'StateCode'>;
	 * const state = column.char<StateCode>(2);
	 */
	char: <T extends string = string>(length = 8) =>
		new Column<T, `char(${number})`>(`char(${length})`),
	/**
	 * Creates a varchar column with optional length.
	 * @param length Optional length of the varchar column. Defaults to `32`.
	 * @returns A new {@link Column} instance for varchar.
	 * @remarks
	 * - Designed for variable-length string data with a maximum character limit.
	 * - Accepts an optional generic type parameter to create branded or literal string types.
	 * - The type parameter must extend `string` and defaults to `string` if not specified.
	 * - Runtime validation enforces maximum length constraint.
	 * - Ideal for usernames, email addresses, titles, or any bounded-length text fields.
	 *
	 * @example
	 * // Basic usage with default length (32)
	 * const username = column.varchar();
	 *
	 * // With specific length for email addresses
	 * const email = column.varchar(255);
	 *
	 * // With branded type for URLs
	 * type URL = Branded<string, 'URL'>;
	 * const website = column.varchar<URL>(500);
	 */
	varchar: <T extends string = string>(length = 32) =>
		new Column<T, `varchar(${number})`>(`varchar(${length})`),
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
	 * Creates an email column.
	 * @returns A new {@link Column} instance for emails.
	 * @remarks
	 * - This column type is used for storing email address strings.
	 * - Includes built-in validation to ensure the value is a valid email format.
	 */
	email: () => new Column<Email, 'email'>('email'),

	/**
	 * Creates a URL column.
	 * @returns A new {@link Column} instance for URLs.
	 * @remarks
	 * - This column type is used for storing URL strings.
	 * - Includes built-in validation to ensure the value is a valid URL format.
	 */
	url: () => new Column<URLString, 'url'>('url'),
	/**
	 * Creates a boolean column. Same as {@link column.boolean boolean}.
	 * @returns A new {@link Column} instance for booleans.
	 * @remarks
	 * - Stores true/false binary values.
	 * - Accepts an optional generic type parameter to create branded boolean types.
	 * - The type parameter must extend `boolean` and defaults to `boolean` if not specified.
	 * - Commonly used for flags, toggles, or binary state indicators.
	 *
	 * @example
	 * // Basic usage
	 * const isActive = column.bool();
	 *
	 * // With branded type for domain-specific boolean
	 * type EmailVerified = Branded<boolean, 'EmailVerified'>;
	 * const verified = column.bool<EmailVerified>();
	 */
	bool: <T extends boolean = boolean>() => new Column<T, 'bool'>('bool'),
	/**
	 * Creates a boolean column. Same as {@link column.bool bool}.
	 * @returns A new {@link Column} instance for booleans.
	 * @remarks
	 * - Stores true/false binary values.
	 * - Accepts an optional generic type parameter to create branded boolean types.
	 * - The type parameter must extend `boolean` and defaults to `boolean` if not specified.
	 * - Functionally identical to `bool()`, provided as an alias for readability preference.
	 *
	 * @example
	 * // Basic usage
	 * const isPremium = column.boolean();
	 *
	 * // With branded type
	 * type TwoFactorEnabled = Branded<boolean, 'TwoFactorEnabled'>;
	 * const twoFactor = column.boolean<TwoFactorEnabled>();
	 */
	boolean: <T extends boolean = boolean>() => new Column<T, 'boolean'>('boolean'),
	/**
	 * Creates a date column.
	 * @returns A new {@link Column} instance for dates.
	 * @remarks This column type is used for storing date values.
	 */
	date: () => new Column<Date, 'date'>('date'),
	/**
	 * Creates an object column.
	 * @returns A new {@link Column} instance for objects.
	 * @remarks
	 * - Stores structured data as JavaScript objects with string keys.
	 * - Requires a generic type parameter defining the object's shape for type safety.
	 * - The type parameter must extend `GenericObject` (Record<string, any>).
	 * - IndexedDB natively supports object storage without serialization overhead.
	 * - Ideal for storing complex nested data structures, JSON-like data, or configuration objects.
	 *
	 * @example
	 * // With typed interface
	 * interface UserProfile {
	 *   avatar: string;
	 *   bio: string;
	 *   socials: { twitter?: string; github?: string };
	 * }
	 * const profile = column.object<UserProfile>();
	 *
	 * // With inline type
	 * const settings = column.object<{ theme: 'light' | 'dark'; notifications: boolean }>();
	 */
	object: <Obj extends GenericObject>() => new Column<Obj, `object`>(`object`),
	/**
	 * Creates an array column.
	 * @returns A new {@link Column} instance for arrays.
	 * @remarks
	 * - Stores ordered collections of elements as mutable JavaScript arrays.
	 * - Accepts an optional generic type parameter defining the element type.
	 * - Defaults to `any` if not specified, but explicit typing is recommended for type safety.
	 * - IndexedDB natively supports array storage.
	 * - Suitable for lists, collections, or any ordered sequence of values.
	 *
	 * @example
	 * // Basic usage with explicit type
	 * const tags = column.array<string>();
	 *
	 * // With complex element types
	 * interface Comment { author: string; text: string; date: string; }
	 * const comments = column.array<Comment>();
	 *
	 * // With union types
	 * const mixedData = column.array<string | number>();
	 */
	array: <T = any>() => new Column<Array<T>, `array`>(`array`),
	/**
	 * Creates a list column.
	 * @returns A new {@link Column} instance for lists.
	 * @remarks
	 * - Stores ordered collections as read-only arrays (`ReadonlyArray<T>`).
	 * - Accepts an optional generic type parameter defining the element type.
	 * - Defaults to `any` if not specified, but explicit typing is recommended.
	 * - Type-level immutability prevents accidental modifications in consuming code.
	 * - Semantically indicates the data should not be mutated, though IndexedDB storage is identical to arrays.
	 *
	 * @example
	 * // Basic usage
	 * const allowedRoles = column.list<string>();
	 *
	 * // With object elements
	 * interface Permission { resource: string; actions: string[]; }
	 * const permissions = column.list<Permission>();
	 */
	list: <T = any>() => new Column<List<T>, `list`>(`list`),
	/**
	 * Creates a tuple column.
	 * @returns A new {@link Column} instance for tuples.
	 * @remarks
	 * - Stores fixed-size, ordered collections with potentially different element types.
	 * - Accepts an optional generic type parameter defining the tuple structure.
	 * - Defaults to `any` if not specified, but explicit tuple types are strongly recommended.
	 * - Type-level enforcement ensures correct element types at each position.
	 * - Ideal for coordinate pairs, RGB values, or any fixed-length heterogeneous data.
	 *
	 * @example
	 * // Coordinate pair [x, y]
	 * const position = column.tuple<number, number>();
	 *
	 * // RGB color [red, green, blue]
	 * const color = column.tuple<number, number, number>();
	 *
	 * // Mixed types [name, age, isActive]
	 * const userInfo = column.tuple<string, number, boolean>();
	 */
	tuple: <T = any>() => new Column<Tuple<T>, `tuple`>(`tuple`),
	/**
	 * Creates a set column.
	 * @returns A new {@link Column} instance for sets.
	 * @remarks
	 * - Stores unique, unordered collections using JavaScript `Set` objects.
	 * - Accepts an optional generic type parameter defining the element type.
	 * - Defaults to `any` if not specified, but explicit typing improves type safety.
	 * - Automatically ensures uniqueness of elements at runtime via Set semantics.
	 * - Useful for tags, categories, unique identifiers, or any collection requiring distinctness.
	 *
	 * @example
	 * // Unique tags
	 * const tags = column.set<string>();
	 *
	 * // Unique user IDs
	 * const followerIds = column.set<number>();
	 *
	 * // Unique literal values
	 * const permissions = column.set<'read' | 'write' | 'delete'>();
	 */
	set: <T = any>() => new Column<Set<T>, `set`>(`set`),
	/**
	 * Creates a map column.
	 * @returns A new {@link Column} instance for maps.
	 * @remarks
	 * - Stores key-value pairs using JavaScript `Map` objects.
	 * - Accepts two optional generic type parameters: key type `K` and value type `V`.
	 * - Both default to `any` if not specified, but explicit typing is recommended.
	 * - Maintains insertion order and allows any type as keys (unlike plain objects).
	 * - Ideal for dictionaries, lookup tables, caches, or associative data structures.
	 *
	 * @example
	 * // String keys to number values
	 * const scores = column.map<string, number>();
	 *
	 * // Number keys to object values
	 * interface User { name: string; email: string; }
	 * const userCache = column.map<number, User>();
	 *
	 * // Literal keys to union values
	 * const config = column.map<'theme' | 'lang', string | boolean>();
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
};
