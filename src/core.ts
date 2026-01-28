import { isNonEmptyString } from 'nhb-toolbox';
import type { ColumnDefinition } from './types';

/** Symbol for type extraction (exists only in type system) */
export const $ColumnType = Symbol('$ColumnType');

/** Symbols for internal Column properties (hidden from user IntelliSense) */
export const ColumnType = Symbol('ColumnType');
export const IsPrimaryKey = Symbol('IsPrimaryKey');
export const IsAutoInc = Symbol('IsAutoInc');
export const IsOptional = Symbol('IsOptional');
export const IsIndexed = Symbol('IsIndexed');
export const IsUnique = Symbol('IsUnique');
export const DefaultValue = Symbol('DefaultValue');

/**
 * Represents a column definition.
 */
export class Column<T = any> {
	declare [$ColumnType]: T;
	declare [ColumnType]: string;
	declare [IsPrimaryKey]?: boolean;
	declare [IsAutoInc]?: boolean;
	declare [IsOptional]?: boolean;
	declare [IsIndexed]?: boolean;
	declare [IsUnique]?: boolean;
	declare [DefaultValue]?: T;

	constructor(type: string) {
		this[ColumnType] = type;
	}

	// get type(): string {
	// 	return this[ColumnTypeKey];
	// }

	/** Marks column as primary key */
	pk() {
		this[IsPrimaryKey] = true;
		return this as this & { [IsPrimaryKey]: true };
	}

	unique() {
		this[IsIndexed] = true;
		this[IsUnique] = true;

		return this as this & {
			[IsIndexed]: true;
			[IsUnique]: true;
		};
	}

	/** Enables auto increment - only available for numeric columns */
	auto(): T extends number ? this & { [IsAutoInc]: true } : Omit<this, 'auto'> {
		const colType = this[ColumnType];

		const allowedTypes = ['int', 'integer', 'float', 'number'];

		if (!isNonEmptyString(colType) || !allowedTypes.includes(colType.toLowerCase())) {
			throw new Error(`auto() can only be used with integer columns, got: ${colType}`);
		}

		this[IsAutoInc] = true;

		return this as T extends number ? this & { [IsAutoInc]: true } : Omit<this, 'auto'>;
	}

	/** Adds an index */
	index() {
		this[IsIndexed] = true;
		return this as this & { [IsIndexed]: true };
	}

	default<Default extends T>(value: Default) {
		this[DefaultValue] = value;
		return this as this & { [DefaultValue]: Default };
	}

	optional() {
		this[IsOptional] = true;
		return this as this & { [IsOptional]: true };
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
