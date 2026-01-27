import type { ColumnDefinition } from './types';

/** Symbol for type extraction (exists only in type system) */
export const ColumnType = Symbol('ColumnTypeSymbol');

/** Symbols for internal Column properties (hidden from user IntelliSense) */
export const TypeKey = Symbol('TypeKey');
export const PrimaryKey = Symbol('PrimaryKey');
export const AutoIncrementKey = Symbol('AutoIncrementKey');
export const OptionalKey = Symbol('OptionalKey');
export const IndexedKey = Symbol('IndexedKey');
export const UniqueKey = Symbol('UniqueKey');
export const DefaultValueKey = Symbol('DefaultValueKey');

/**
 * Represents a column definition.
 */
export class Column<T extends any = any> {
	declare [ColumnType]: T;
	declare [TypeKey]: string;
	declare [PrimaryKey]?: boolean;
	declare [AutoIncrementKey]?: boolean;
	declare [OptionalKey]?: boolean;
	declare [IndexedKey]?: boolean;
	declare [UniqueKey]?: boolean;
	declare [DefaultValueKey]?: T;

	constructor(type: string) {
		this[TypeKey] = type;
	}

	// get type(): string {
	// 	return this[ColumnTypeKey];
	// }

	/** Marks column as primary key */
	pk() {
		this[PrimaryKey] = true;
		return this as this & { [PrimaryKey]: true };
	}

	unique() {
		this[IndexedKey] = true;
		this[UniqueKey] = true;

		return this as this & {
			[IndexedKey]: true;
			[UniqueKey]: true;
		};
	}

	/** Enables auto increment - only available for numeric columns */
	auto(): T extends number ? this & { [AutoIncrementKey]: true } : Omit<this, 'auto'> {
		const colType = this[TypeKey];

		if (
			typeof colType !== 'string' ||
			!['int', 'integer', 'float', 'number'].includes(colType.toLowerCase())
		) {
			throw new Error(`auto() can only be used with integer columns, got: ${colType}`);
		}

		this[AutoIncrementKey] = true;

		return this as T extends number ? this & { [AutoIncrementKey]: true }
		:	Omit<this, 'auto'>;
	}

	/** Adds an index */
	index() {
		this[IndexedKey] = true;
		return this as this & { [IndexedKey]: true };
	}

	default<Default extends T>(value: Default) {
		this[DefaultValueKey] = value;
		return this as this & { [DefaultValueKey]: Default };
	}

	optional() {
		this[OptionalKey] = true;
		return this as this & { [OptionalKey]: true };
	}
}

/**
 * Represents a table.
 */
export class Table<C extends ColumnDefinition = ColumnDefinition> {
	readonly name: string;
	readonly columns: C;

	constructor(name: string, columns: C) {
		this.name = name;
		this.columns = columns;
	}
}
