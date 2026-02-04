import type {
	Column,
	DefaultValue,
	IsAutoInc,
	IsIndexed,
	IsNullable,
	IsOptional,
	IsPrimaryKey,
	IsUnique,
	Table,
} from './core';
import type { DeleteQuery, InsertQuery, SelectQuery, UpdateQuery } from './query';

declare const __brand: unique symbol;
type $Brand<B> = {
	[__brand]: B;
};

/**
 * * Creates a branded version of a base type by intersecting it with a unique compile-time marker.
 *
 * @param T - Base type to brand.
 * @param B - Brand identifier used to distinguish this type from structurally similar types.
 
 * @remarks Useful for preventing accidental mixing of structurally identical types, while keeping the runtime value unchanged.
 *
 * @example
 * type UserId = Branded<string, 'UserId'>;
 * const id = 'abc123' as UserId;
 */
export type Branded<T, B> = T & $Brand<B>;

/**
 * * Broadens a literal union (typically `string` or `number`) to also accept any other value of the base type, without losing IntelliSense autocomplete for the provided literals.
 *
 * *This is especially useful in API design where you want to provide suggestions for common options but still allow flexibility for custom user-defined values.*
 *
 * @example
 * // ✅ String literal usage
 * type Variant = LooseLiteral<'primary' | 'secondary'>;
 * const v1: Variant = 'primary';  // suggested
 * const v2: Variant = 'custom';   // also valid
 *
 * // ✅ Number literal usage
 * type StatusCode = LooseLiteral<200 | 404 | 500>;
 * const s1: StatusCode = 200;     // suggested
 * const s2: StatusCode = 999;     // also valid
 *
 * // ✅ Mixed literal
 * type Mixed = LooseLiteral<'one' | 2>;
 * const m1: Mixed = 'one';        // ✅
 * const m2: Mixed = 2;            // ✅
 * const m3: Mixed = 'anything';   // ✅
 * const m4: Mixed = 123;          // ✅
 *
 * @note Technically, this uses intersection with primitive base types (`string & {}` or `number & {}`) to retain IntelliSense while avoiding type narrowing.
 */
export type LooseLiteral<T extends string | number> =
	| T
	| (T extends string ? string & {} : number & {});

export type ForcedAny = any;

/** Union of `number` and numeric string */
export type Numeric = number | `${number}`;

/**
 * * A readonly array of elements of type `T`.
 *
 * @remarks
 * - Shorthand for `ReadonlyArray<T>`. Used to represent immutable lists.
 *
 * @example
 * type Numbers = List<number>;	// readonly number[]
 * const arr: Numbers = [1, 2, 3];	// ✅ OK
 * arr.push(4);                   	// ❌ Error (readonly)
 */
export type List<T = any> = ReadonlyArray<T>;

/** Turns a union into an intersection */
export type $UnionToIntersection<U> =
	(U extends any ? (arg: U) => void : never) extends (arg: infer I) => void ? I : never;

/** Gets the "last" item of a union */
type $LastOf<T> =
	$UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R : never;

/** Converts a union to a tuple */
type $UnionToTuple<T, L = $LastOf<T>> =
	[T] extends [never] ? [] : [...$UnionToTuple<Exclude<T, L>>, L];

/**
 * * Converts a type into a tuple form.
 *
 * @remarks
 * - If `T` is a union, it produces a tuple containing each member of the union.
 * - If `T` is a single type, it produces a one-element tuple `[T]`.
 * - If `T` is `never`, it produces an empty tuple `[]`.
 *
 * @param T - The type to convert into a tuple.
 * @returns A tuple type containing the elements of `T`.
 *
 * @example
 * type T0 = Tuple<"foo" | "bar">; // ["foo", "bar"]
 * type T1 = Tuple<number>; // [number]
 * type T2 = Tuple<1 | 2 | 3>; // [1, 2, 3]
 * type T3 = Tuple<never>; // []
 */
export type Tuple<T> = [T] extends [never] ? [] : $UnionToTuple<T>;

/**
 * * Converts an array type containing a union of literals into a tuple of those literals.
 *
 * @remarks
 * - Takes an array type `T` (e.g. `("foo" | "bar")[]`) and produces a tuple type (e.g. `["foo", "bar"]`).
 * - Useful when you want to preserve all possible union members as a tuple literal instead of an array.
 * - For converting any type to tuple use {@link Tuple}.
 *
 * @param T - An array type whose element type is a union.
 * @returns A tuple type containing each member of the union in order.
 *
 * @example
 * type T0 = ArrayToTuple<("foo" | "bar")[]>; // ["foo", "bar"]
 * type T1 = ArrayToTuple<(1 | 2 | 3)[]>; // [1, 2, 3]
 * type T2 = ArrayToTuple<never[]>; // []
 */
export type ArrayToTuple<T extends readonly unknown[]> =
	T[number] extends infer U ? $UnionToTuple<U> : never;

/** Represents a value that may or may not be present. */
export type Maybe<T> = T | undefined;

/** Union of Basic Primitive Types (i.e. `string | number | boolean`) */
export type BasicPrimitive = string | number | boolean;

/** Union of All Primitive Types (i.e. `string | number | boolean | symbol | bigint | null | undefined`) */
export type Primitive = string | number | boolean | symbol | bigint | null | undefined;

/** Union of Normal Primitive Types (i.e. `string | number | boolean | null | undefined`) */
export type NormalPrimitive = string | number | boolean | null | undefined;

/** A generic class constructor */
export type Constructor = new (...args: any[]) => any;

/** Generic function type */
export type GenericFn = (...args: any[]) => any;

/** Generic function type that returns `void` */
export type VoidFn = (...args: any[]) => void;

/** Type for reject function of a promise */
export type RejectFn = (reason: unknown) => void;

/** Validator function type for {@link Column.validate()} */
export type ValidatorFn<T = any> = (value: T) => string | null | undefined;

/** Updater function type for {@link Column.onUpdate()} */
export type UpdaterFn<T = any> = (currentValue?: T) => T;

/** Asynchronous function type */
export type AsyncFunction<T> = (...args: any[]) => Promise<T>;

/** Interface representing a date-like object. */
export interface DateLike {
	toJSON?(): string;
	toISOString?(): string;
	toString?(): string;
	format?(): string;
	toISO?(): string;
	toFormat?(format: string): string;
	plus?(...args: unknown[]): unknown;
	minus?(...args: unknown[]): unknown;
	equals?(...args: unknown[]): boolean;
	getClass?(): unknown;
	constructor?: {
		name: string;
	};
}

/** Advanced types to exclude from counting as object key */
export type AdvancedTypes =
	| Array<unknown>
	| File
	| FileList
	| Blob
	| Date
	| RegExp
	| Constructor
	| DateLike
	| WeakMap<WeakKey, unknown>
	| WeakSet<WeakKey>
	| Map<unknown, unknown>
	| Set<unknown>
	| Function
	| GenericFn
	| VoidFn
	| AsyncFunction<unknown>
	| Promise<unknown>
	| Error
	| EvalError
	| RangeError
	| ReferenceError
	| SyntaxError
	| TypeError
	| URIError
	| bigint
	| symbol;

/**
 * * Extracts the parameters of the first overload of a function type `T`.
 *
 * @template T - The function type to extract parameters from.
 *
 * @returns A tuple type representing the parameters of the first overload of `T`.
 *
 * @example
 * type Fn = {
 *   (a: number, b: string): void;
 *   (x: boolean): void;
 * };
 *
 * type Params = FirstOverloadParams<Fn>; // [a: number, b: string]
 */
export type FirstOverloadParams<T> =
	T extends (
		{
			(a1: infer P1, ...args: infer P2): any;
			(...args: any[]): any;
		}
	) ?
		[P1, ...P2]
	: T extends (
		{
			(...args: infer P): any;
			(...args: any[]): any;
		}
	) ?
		P
	: T extends (...args: infer P) => any ? P
	: never;

/**
 * * Maps all values of object `T` to a fixed type `R`, keeping original keys.
 *
 * @template T - The source object type.
 * @template R - The replacement value type.
 *
 * @example
 * type T = { name: string; age: number };
 * type BooleanMapped = MapObjectValues<T, boolean>; // { name: boolean; age: boolean }
 */
export type MapObjectValues<T, R> = {
	[K in keyof T]: R;
};

/**
 * Determines if a selection object has any true values
 */
type HasTrueValues<Selection extends Partial<Record<any, boolean>>> =
	{
		[K in keyof Selection]: Selection[K] extends true ? true : never;
	}[keyof Selection] extends never ?
		false
	:	true;

/**
 * Extracts only the selected fields from an object.
 * Used for SELECT clause to pick specific columns.
 * - If any value is true: returns only fields marked as true
 * - If all values are false: returns all fields EXCEPT those marked as false
 */
export type SelectFields<
	T,
	Selection extends Partial<Record<keyof T, boolean>> = Record<keyof T, true>,
> = Prettify<
	HasTrueValues<Selection> extends true ?
		{
			[K in keyof Selection as Selection[K] extends true ? K : never]: K extends keyof T ?
				T[K]
			:	never;
		}
	:	{
			[K in keyof T as K extends keyof Selection ?
				Selection[K] extends false ?
					never
				:	K
			:	K]: T[K];
		}
>;

/** Pagination options for cursor-based queries */
export type PageOptions = {
	/** Cursor key returned from a previous page */
	cursor?: IDBValidKey;
	/** Maximum number of records to return */
	limit?: number;
};

/** Cursor-based pagination result */
export type PageResult<T, Selection extends Partial<Record<keyof T, boolean>> | null> = {
	items: Selection extends null ? T[] : SelectFields<T, Extract<Selection, object>>[];
	nextCursor: Maybe<IDBValidKey>;
};

/** - Extract only primitive keys from an object, including nested dot-notation keys. */
export type NestedPrimitiveKey<T> =
	T extends AdvancedTypes ? never
	: T extends GenericObject ?
		{
			[K in keyof T & string]: T[K] extends Function ? never
			: T[K] extends NormalPrimitive ? K
			: T[K] extends GenericObject ? `${K}.${NestedPrimitiveKey<T[K]>}`
			: never;
		}[keyof T & string]
	:	never;

/** - Generic object but with `any` value */
export type GenericObject = Record<string, any>;
/**
 * * Forces TypeScript to simplify a complex or inferred type into a more readable flat object.
 *
 * *Useful when working with utility types like `Merge`, `Omit`, etc., that produce deeply nested or unresolved intersections.*
 *
 * @example
 * type A = { a: number };
 * type B = { b: string };
 * type Merged = A & B;
 * type Pretty = Prettify<Merged>;
 * // Type will now display as: { a: number; b: string }
 */
export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

/** General 5 parts UUID string type */
export type $UUID = `${string}-${string}-${string}-${string}-${string}`;

/** UUID versions as number from `1-8` */
export type $UUIDVersion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** UUID versions as string from `v1-v8` */
export type UUIDVersion = `v${$UUIDVersion}`;

/** General 5 parts UUID string as {@link Branded} type */
export type UUID<V extends UUIDVersion> = Branded<$UUID, V>;

/** Locality database configuration type */
export type LocalityConfig<DB extends string, V extends number, S extends SchemaDefinition> = {
	/** Database name */
	dbName: DB;
	/** Database version */
	version?: V;
	/** Database schema */
	schema: S;
};

/** Column definition type - preserves both Column generics */
export type ColumnDefinition = Record<string, Column<any, string>>;

/** Validated column definition with single PK constraint */
export type ValidatedColumnDefinition<T extends ColumnDefinition = ColumnDefinition> =
	$ValidateSinglePK<T> extends T ? T : never;

/** Record of column definitions */
export type ColumnRecord = Record<string, ColumnDefinition>;

/** Schema record type mapping table names to {@link Table} instances */
export type SchemaRecord<T extends ColumnRecord, Keys extends keyof T> = {
	[K in Keys]: Table<T[K]>;
};

/** Schema definition type */
export type SchemaDefinition<T extends ColumnDefinition = ColumnDefinition> = Record<
	string,
	Table<T>
>;

/** Helper to reliably extract the generic type parameter from a Column directly from its type parameters. */
type ExtractColumnType<C> = C extends Column<infer T, TypeName> ? T : never;

/** Extracts inferred row type from columns. */
export type $InferRow<T extends ColumnDefinition> = Prettify<
	Omit<
		{
			[K in keyof T]: ExtractColumnType<T[K]>;
		},
		$InferOptional<T>
	> & {
		[K in $InferOptional<T>]?: ExtractColumnType<T[K]>;
	} & {
		[K in $InferDefault<T> | $InferUUID<T> | $InferTimestamp<T>]: ExtractColumnType<T[K]>;
	}
>;

/** Finds the field name with autoIncrement set to true. */
export type $InferAutoInc<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends { [IsAutoInc]: true } ? K : never;
}[keyof T];

/** Finds the field name with default value. */
export type $InferDefault<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends { [DefaultValue]: any } ? K : never;
}[keyof T];

/** Finds the field name with primary key. */
export type $InferPrimaryKey<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends { [IsPrimaryKey]: true } ? K : never;
}[keyof T];

/** Counts the number of primary keys in a column definition. */
type $CountPrimaryKeys<T extends ColumnDefinition> =
	{
		[K in keyof T]: T[K] extends { [IsPrimaryKey]: true } ? K : never;
	}[keyof T] extends infer U ?
		U extends never ? 0
		: [U] extends [infer Single] ?
			Single extends keyof T ?
				1
			:	never
		:	2
	:	never;

/** Validates that a column definition has exactly one primary key. */
export type $ValidateSinglePK<T extends ColumnDefinition> =
	$CountPrimaryKeys<T> extends 1 ? T
	: $CountPrimaryKeys<T> extends 0 ? 'Error: Schema must have exactly one primary key'
	: 'Error: Schema can only have one primary key';

/** Finds the field name with partial key. */
export type $InferOptional<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends { [IsOptional]: true } ? K : never;
}[keyof T];

/** Finds the field name with nullable key. */
export type $InferNullable<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends { [IsNullable]: true } ? K : never;
}[keyof T];

/** Finds the field name with unique key. */
export type $InferUnique<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends { [IsUnique]: true } ? K : never;
}[keyof T];

/** Finds the field name with index key. */
export type $InferIndex<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends { [IsIndexed]: true } ? K : never;
}[keyof T];

/**
 * Finds the field name with {@link UUID} type.
 */
export type $InferUUID<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends Column<infer C, TypeName> ?
		C extends $UUID ?
			K
		:	never
	:	never;
}[keyof T];

/** Finds the field name with {@link Timestamp} type. */
export type $InferTimestamp<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends Column<infer C, TypeName> ?
		C extends Timestamp ?
			K
		:	never
	:	never;
}[keyof T];

/** Timestamp string type in ISO 8601 format */
export type Timestamp = Branded<string, 'Timestamp'>;

/** Sort direction type for ordering queries */
export type SortDirection = 'asc' | 'desc';

/** Predicate function type for WHERE clauses in queries */
export type WherePredicate<T extends GenericObject> = (row: T) => boolean;

/** Creates a type for insert operations with auto-generated fields optional. */
export type InferInsertType<T extends Table> = Prettify<
	Omit<
		$InferRow<T['columns']>,
		| $InferAutoInc<T['columns']>
		| $InferDefault<T['columns']>
		| $InferTimestamp<T['columns']>
		| $InferUUID<T['columns']>
	> & {
		[K in $InferNullable<T['columns']>]: K extends keyof $InferRow<T['columns']> ?
			$InferRow<T['columns']>[K] | null
		:	never;
	} & {
		[K in
			| $InferAutoInc<T['columns']>
			| $InferDefault<T['columns']>
			| $InferTimestamp<T['columns']>
			| $InferUUID<T['columns']>]?: K extends keyof $InferRow<T['columns']> ?
			$InferRow<T['columns']>[K]
		:	never;
	}
>;

/** Creates a type for update operations with all fields optional except primary key. */
export type InferUpdateType<T extends Table> = Prettify<
	Partial<Omit<$InferRow<T['columns']>, $InferPrimaryKey<T['columns']>>>
>;

/** Creates a type for select operations. */
export type InferSelectType<S extends Table> = Prettify<
	S extends infer T ?
		T extends Table<infer C> ?
			$InferRow<C>
		:	never
	:	never
>;

export type PrimaryKeyType<S extends Table> = InferSelectType<S>[$InferPrimaryKey<
	S['columns']
>];

export type IndexKeyType<S extends Table> = InferSelectType<S>[$InferUnique<S['columns']>];

export type UniqueKeyType<S extends Table> = InferSelectType<S>[$InferIndex<S['columns']>];

/** Column type strings used in {@link Column} definitions */
export type TypeName = LooseLiteral<
	| 'int'
	| 'float'
	| 'number'
	| 'numeric'
	| 'bigint'
	| 'text'
	| 'string'
	| `char${number}`
	| `varchar${number}`
	| 'uuid'
	| 'timestamp'
	| 'email'
	| 'url'
	| 'bool'
	| 'boolean'
	| 'date'
	| 'object'
	| 'array'
	| 'list'
	| 'tuple'
	| 'set'
	| 'map'
	| 'custom'
>;

/** Email string type in basic format */
export type Email = `${string}@${string}.${string}`;

/** URL string type in basic format */
export type URLString = `${string}://${string}`;

/** Index configuration type for `IndexedDB` */
export type IndexConfig = {
	/** Index name (typically the field name) */
	name: string;
	/** Key path for the index */
	keyPath: string;
	/** Whether the index enforces unique values */
	unique?: boolean;
};

/** Store configuration type for `IndexedDB` */
export type StoreConfig = {
	/** Store name */
	name: string;
	// TODO: Handle multiple primary keys later
	/** Primary key path(s) */
	keyPath?: string;
	/** Whether the primary key is auto-incrementing */
	autoIncrement?: boolean;
	/** Array of index configurations for this store */
	indexes?: IndexConfig[];
};

/** Export options for database `export` method */
export type ExportOptions<T extends string> = {
	/** Optional array of table names to export (exports all if not specified) */
	tables?: T[];
	/** Optional custom filename (default: `{dbName}-export-{timestamp}.json`) */
	filename?: string;
	/** Optional flag to enable pretty-printed JSON (default: `true`) */
	pretty?: boolean;
	/** Optional flag to include export metadata (default: `true`) */
	includeMetadata?: boolean;
};

/** Import options for database `import` method */
export type ImportOptions<T extends string> = {
	/** Optional array of table names to import (imports all if not specified) */
	tables?: T[];
	/** Import mode: replace, merge, or upsert (default: merge) */
	mode?: 'replace' | 'merge' | 'upsert';
};

/** Exported database data structure */
export type ExportData = {
	/** Optional metadata about the export */
	metadata?: {
		/** Database name */
		dbName: string;
		/** Database version */
		version: number;
		/** Export creation time */
		exportedAt: Timestamp;
		/** List of exported table names */
		tables: string[];
	};
	/** Actual exported data, mapping table names to arrays of records */
	data: Record<string, GenericObject[]>;
};

/** Transaction context type providing methods for database operations within a transaction */
export type TransactionContext<
	Schema extends SchemaDefinition,
	TName extends keyof Schema,
	Tables extends TName[],
> = {
	/** Inserts a new record into the specified table */
	insert: <
		T extends Tables[number],
		Raw extends InferInsertType<Schema[T]>,
		Inserted extends Raw | Raw[],
		Data extends InferSelectType<Schema[T]>,
		Return extends Inserted extends Array<infer _> ? Data[] : Data,
	>(
		table: T
	) => InsertQuery<Raw, Inserted, Data, Return>;

	/** Updates an existing record in the specified table */
	update: <T extends Tables[number], Row extends $InferRow<Schema[T]['columns']>>(
		table: T
	) => UpdateQuery<Row, Schema[T]>;

	/** Deletes a record from the specified table */
	delete: <T extends Tables[number], Row extends $InferRow<Schema[T]['columns']>>(
		table: T
	) => DeleteQuery<Row, keyof Row, Schema[T]>;

	/** Retrieves a record by primary key from the specified table */
	from: <T extends Tables[number], Row extends $InferRow<Schema[T]['columns']>>(
		table: T
	) => SelectQuery<Row, null, Schema[T]>;
};

/** Transaction callback function type */
export type TransactionCallback<
	Schema extends SchemaDefinition,
	TName extends keyof Schema,
	Tables extends TName[],
> = (ctx: TransactionContext<Schema, TName, Tables>) => Promise<void>;
