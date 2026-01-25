import type { Prettify } from 'nhb-toolbox/utils/types';
import type { Column, Table } from './core';
import type { $UUID } from 'nhb-toolbox/hash/types';

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
export type $InferRow<T extends ColumnDefinition> = {
	[K in keyof T]: ExtractColumnType<T[K]>;
};

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

/**
 * Creates a type for insert operations with auto-increment field optional.
 */
export type InferInsertType<T extends Table> = Prettify<
	Omit<
		$InferRow<T['columns']>,
		| $InferAutoField<T['columns']>
		| $InferDefaultField<T['columns']>
		| $InferOptionalField<T['columns']>
		| $InferTimestamp<T['columns']>
		| $InferUUIDField<T['columns']>
	> & {
		[K in
			| $InferAutoField<T['columns']>
			| $InferDefaultField<T['columns']>
			| $InferOptionalField<T['columns']>
			| $InferTimestamp<T['columns']>
			| $InferUUIDField<T['columns']>]?: $InferRow<T['columns']>[K];
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
