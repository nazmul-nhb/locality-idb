import type { Column, Table } from './core';

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
	} & {
		[K in $InferDefaultField<T>]: ExtractColumnType<T[K]>;
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

export type Timestamp = Branded<
	`${number}-${number}-${number}T${number}:${number}:${number}.${number}${'Z' | `${'+' | '-'}${number}:${number}`}`,
	'timestamp'
>;

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

export type InferSelectType<S extends Table> = Prettify<
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
