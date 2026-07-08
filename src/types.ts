import type { Maybe, Nullable, Uncertain } from 'toolbox-x/types';
import type { $UUID } from 'toolbox-x/types/hash';
import type { GenericObject } from 'toolbox-x/types/object';
import type { LooseLiteral, Prettify } from 'toolbox-x/types/utils';
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

export type {
	AdvancedTypes,
	AsyncFunction,
	BasicPrimitive,
	Branded,
	Constructor,
	GenericFn,
	List,
	Maybe,
	NormalPrimitive,
	Nullable,
	Numeric,
	Primitive,
	Uncertain,
	VoidFn,
} from 'toolbox-x/types';
export type { DateLike } from 'toolbox-x/types/date';
export type { $UUID, $UUIDVersion, UUID, UUIDVersion } from 'toolbox-x/types/hash';
export type { GenericObject, NestedPrimitiveKey } from 'toolbox-x/types/object';
export type {
	ArrayToTuple,
	LooseLiteral,
	MapObjectValues,
	Prettify,
	Tuple,
} from 'toolbox-x/types/utils';

export type ForcedAny = any;

/** Type for reject function of a promise */
export type RejectFn = (reason: unknown) => void;

/** Resolves the actual column value type considering nullable and optional modifiers */
export type ColumnValue<Col, T> = Col extends { [IsNullable]: true }
	? Col extends { [IsOptional]: true }
		? Uncertain<T>
		: Nullable<T>
	: Col extends { [IsOptional]: true }
		? Maybe<T>
		: T;

/** Validator function type for {@link Column.validate()} */
export type ValidatorFn<T = any> = (value: T) => Uncertain<string>;

/** Updater function type for {@link Column.onUpdate()} */
export type UpdaterFn<T = any> = (currentValue: T) => T;

/**
 * * Extracts the parameters of the first overload of a function type `T`.
 *
 * @typeParam T - The function type to extract parameters from.
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
export type FirstOverloadParams<T> = T extends {
	(a1: infer P1, ...args: infer P2): any;
	(...args: any[]): any;
}
	? [P1, ...P2]
	: T extends {
				(...args: infer P): any;
				(...args: any[]): any;
			}
		? P
		: T extends (...args: infer P) => any
			? P
			: never;

/**
 * Determines if a selection object has any true values
 */
type HasTrueValues<Selection extends Partial<Record<any, boolean>>> = {
	[K in keyof Selection]: Selection[K] extends true ? true : never;
}[keyof Selection] extends never
	? false
	: true;

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
	HasTrueValues<Selection> extends true
		? {
				[K in keyof Selection as Selection[K] extends true
					? K
					: never]: K extends keyof T ? T[K] : never;
			}
		: {
				[K in keyof T as K extends keyof Selection
					? Selection[K] extends false
						? never
						: K
					: K]: T[K];
			}
>;

/** Callback function type for cursor-based queries */
export type CursorCallback<T extends GenericObject> = (
	row: T,
	index: number
) => void | Promise<void>;

/** Pagination options for cursor-based queries */
export interface PageOptions {
	/** Cursor key returned from a previous page */
	cursor?: IDBValidKey;
	/** Maximum number of records to return */
	limit?: number;
}

/** Cursor-based pagination result */
export interface PageResult<T, Selection extends Nullable<Partial<Record<keyof T, boolean>>>> {
	/** Retrieved items for the current page */
	items: Selection extends null ? T[] : SelectFields<T, Extract<Selection, object>>[];
	/** Cursor key for the next page, if more results are available */
	nextCursor: Maybe<IDBValidKey>;
}

/** Locality database configuration type */
export interface LocalityConfig<
	DB extends string,
	V extends number,
	S extends SchemaDefinition,
> {
	/** Database name */
	dbName: DB;
	/** Database version */
	version?: V;
	/** Database schema */
	schema: S;
}

/** Column definition type - preserves both Column generics */
export type ColumnDefinition = Record<string, Column<any, string>>;

/** Validated column definition with single PK constraint */
export type ValidatedColumnDefinition<T extends ColumnDefinition = ColumnDefinition> =
	$ValidateSinglePK<T> extends T ? T : never;

/** Record of column definitions */
export type ColumnRecord = Record<string, ColumnDefinition>;

/** Schema definition from a {@link ColumnRecord column record} */
export type Schema<S extends ColumnRecord> = {
	[K in keyof S & string]: Table<Extract<S[K], ColumnDefinition>>;
};

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
		$InferOptional<T> | $InferNullable<T>
	> & {
		[K in $InferOptional<T>]?: ExtractColumnType<T[K]>;
	} & {
		[K in $InferNullable<T>]: Nullable<ExtractColumnType<T[K]>>;
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
type $CountPrimaryKeys<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends { [IsPrimaryKey]: true } ? K : never;
}[keyof T] extends infer U
	? U extends never
		? 0
		: [U] extends [infer Single]
			? Single extends keyof T
				? 1
				: never
			: 2
	: never;

/** Validates that a column definition has exactly one primary key. */
export type $ValidateSinglePK<T extends ColumnDefinition> =
	$CountPrimaryKeys<T> extends 1
		? T
		: $CountPrimaryKeys<T> extends 0
			? 'Error: Schema must have exactly one primary key'
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
	[K in keyof T]: T[K] extends Column<infer C, TypeName>
		? C extends $UUID
			? K
			: never
		: never;
}[keyof T];

/** Finds the field name with {@link Timestamp} type. */
export type $InferTimestamp<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends Column<infer C, TypeName>
		? C extends Timestamp
			? K
			: never
		: never;
}[keyof T];

/** Timestamp string type in ISO 8601 format */
export type Timestamp =
	`${number}-${number}-${number}T${number}:${number}:${number}.${number}${'Z' | `${'+' | '-'}${number}:${number}`}`;

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
		| $InferNullable<T['columns']>
	> & {
		[K in $InferNullable<T['columns']>]?: $InferRow<T['columns']>[K];
	} & {
		[K in
			| $InferAutoInc<T['columns']>
			| $InferDefault<T['columns']>
			| $InferTimestamp<T['columns']>
			| $InferUUID<T['columns']>]?: K extends keyof $InferRow<T['columns']>
			? $InferRow<T['columns']>[K]
			: never;
	}
>;

/** Creates a type for update operations with all fields optional except primary key. */
export type InferUpdateType<T extends Table> = Prettify<
	Partial<Omit<$InferRow<T['columns']>, $InferPrimaryKey<T['columns']>>>
>;

/** Creates a type for select operations. */
export type InferSelectType<S extends Table> = Prettify<
	S extends infer T ? (T extends Table<infer C> ? $InferRow<C> : never) : never
>;

export type PrimaryKeyType<S extends Table> = InferSelectType<S>[$InferPrimaryKey<
	S['columns']
>];

export type IndexKeyType<S extends Table> = InferSelectType<S>[$InferIndex<S['columns']>];

export type UniqueKeyType<S extends Table> = InferSelectType<S>[$InferUnique<S['columns']>];

/** Column type strings used in {@link Column} definitions */
export type TypeName = LooseLiteral<
	| 'int'
	| 'float'
	| 'number'
	| 'numeric'
	| 'bigint'
	| 'text'
	| 'string'
	| `char(${number})`
	| `varchar(${number})`
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
export interface IndexConfig {
	/** Index name (typically the field name) */
	name: string;
	/** Key path for the index */
	keyPath: string;
	/** Whether the index enforces unique values */
	unique?: boolean;
}

/** Store configuration type for `IndexedDB` */
export interface StoreConfig {
	/** Store name */
	name: string;
	// TODO: Handle multiple primary keys later
	/** Primary key path(s) */
	keyPath?: string;
	/** Whether the primary key is auto-incrementing */
	autoIncrement?: boolean;
	/** Array of index configurations for this store */
	indexes?: IndexConfig[];
}

/** Export options for database `export` method */
export interface ExportOptions<T extends string> {
	/** Optional array of table names to export (exports all if not specified) */
	tables?: T[];
	/** Optional custom filename (default: `{dbName}-export-{timestamp}.json`) */
	filename?: string;
	/** Optional flag to enable pretty-printed JSON (default: `true`) */
	pretty?: boolean;
	/** Optional flag to include export metadata (default: `true`) */
	includeMetadata?: boolean;
}

export type ExportObjectOptions<T extends string> = Omit<
	ExportOptions<T>,
	'filename' | 'pretty'
>;

/** Import mode for `import` `'replace'`, `'merge'`, or `'upsert'` */
export type ImportMode = 'replace' | 'merge' | 'upsert';

/** Import options for database `import` method */
export interface ImportOptions<T extends string> {
	/** Optional array of table names to import (imports all tables (store) if not specified) */
	tables?: T[];
	/** Import mode: `'replace'`, `'merge'`, or `'upsert'` (default: `'merge'`) */
	mode?: ImportMode;
}

/** Exported table data structure */
export type ExportedTableData<T extends string, S extends SchemaDefinition> = Prettify<{
	[K in T]: InferSelectType<S[K]>[];
}>;

/** Metadata about the export */
export interface ExportMetaData<T extends string> {
	/** Database name */
	dbName: string;
	/** Database version */
	version: number;
	/** Export creation time */
	exportedAt: Timestamp;
	/** List of exported table names */
	tables: T[];
}

/** Exported database data structure */
export interface ExportData<T extends string, S extends SchemaDefinition> {
	/** Optional metadata about the export */
	metadata?: ExportMetaData<T>;
	/** Actual exported data, mapping table names to arrays of records */
	data: ExportedTableData<T, S>;
}

/** Transaction context type providing methods for database operations within a transaction */
export interface TransactionContext<
	Schema extends SchemaDefinition,
	TName extends keyof Schema,
	Tables extends TName[],
> {
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
}

/** Transaction callback function type */
export type TransactionCallback<
	Schema extends SchemaDefinition,
	TName extends keyof Schema,
	Tables extends TName[],
> = (ctx: TransactionContext<Schema, TName, Tables>) => Promise<void>;
