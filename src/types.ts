import type { Column, Table } from './core';

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

export type SchemaDefinition<T extends ColumnDefinition = ColumnDefinition> = Record<
	string,
	Table<T>
>;

export type LocalityConfig<DB extends string, V extends number, S extends SchemaDefinition> = {
	dbName: DB;
	version: V;
	schema: S;
};

/** Symbol for type extraction (exists only in type system) */
export declare const ColumnTypeSymbol: unique symbol;

export type ColumnDefinition<T extends any = any> = Record<string, Column<T>>;

/**
 * Helper to reliably extract the generic type parameter from a Column using a symbol property.
 */
type ExtractColumnType<C> = C extends { [ColumnTypeSymbol]: infer U } ? U : never;

/**
 * Extracts inferred row type from columns.
 */
export type $InferRow<T extends ColumnDefinition> = Prettify<
	Omit<
		{
			[K in keyof T]: ExtractColumnType<T[K]>;
		},
		$InferOptionalField<T>
	> & {
		[K in $InferOptionalField<T>]?: ExtractColumnType<T[K]>;
	}
>;

/**
 * Finds the field name with autoIncrement set to true.
 */
export type $InferAutoField<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends { autoIncrement: true } ? K : never;
}[keyof T];

/**
 * Finds the field name with default value.
 */
export type $InferDefaultField<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends { defaultValue: any } ? K : never;
}[keyof T];

/**
 * Finds the field name with primary key.
 */
export type $InferPkField<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends { primaryKey: true } ? K : never;
}[keyof T];

/**
 * Finds the field name with partial key.
 */
export type $InferOptionalField<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends { optional: true } ? K : never;
}[keyof T];

/**
 * Finds the field name with UUID type.
 */
export type $InferUUIDField<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends Column<infer C> ?
		C extends $UUID ?
			K
		:	never
	:	never;
}[keyof T];

/**
 * Finds the field name with UUID type.
 */
export type $InferTimestamp<T extends ColumnDefinition> = {
	[K in keyof T]: T[K] extends Column<infer C> ?
		C extends Timestamp ?
			K
		:	never
	:	never;
}[keyof T];

export type Timestamp =
	`${number}-${number}-${number}T${number}:${number}:${number}.${number}${'Z' | `${'+' | '-'}${number}:${number}`}`;

export type SortDirection = 'asc' | 'desc';

/**
 * Creates a type for insert operations with auto-increment field optional.
 */
export type InferInsertType<T extends Table> = Prettify<
	Omit<
		$InferRow<T['columns']>,
		| $InferAutoField<T['columns']>
		| $InferDefaultField<T['columns']>
		| $InferTimestamp<T['columns']>
		| $InferUUIDField<T['columns']>
	> & {
		[K in
			| $InferAutoField<T['columns']>
			| $InferDefaultField<T['columns']>
			| $InferTimestamp<T['columns']>
			| $InferUUIDField<T['columns']>]?: K extends keyof $InferRow<T['columns']> ?
			$InferRow<T['columns']>[K]
		:	never;
	}
>;

export type InferUpdateType<T extends Table> = Prettify<
	Partial<Omit<$InferRow<T['columns']>, $InferPkField<T['columns']>>>
>;

export type InferFromSchema<S extends Table> = Prettify<
	S extends infer T ?
		T extends Table<infer C> ?
			$InferRow<C>
		:	never
	:	never
>;
export type StoreConfig = {
	name: string;
	keyPath?: string | string[];
	autoIncrement?: boolean;
};
