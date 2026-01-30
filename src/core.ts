import { isNonEmptyString } from 'nhb-toolbox';
import type { ColumnDefinition, TypeName } from './types';

/** Symbol for type extraction (exists only in type system) */
export const $ColumnType = Symbol('$ColumnType');

/** Symbol key for column column data type */
export const ColumnType = Symbol('ColumnType');
/** Symbol key for primary key marker */
export const IsPrimaryKey = Symbol('IsPrimaryKey');
/** Symbol key for auto increment marker */
export const IsAutoInc = Symbol('IsAutoInc');
/** Symbol key for optional marker */
export const IsOptional = Symbol('IsOptional');
/** Symbol key for indexed marker */
export const IsIndexed = Symbol('IsIndexed');
/** Symbol key for unique marker */
export const IsUnique = Symbol('IsUnique');
/** Symbol key for default value */
export const DefaultValue = Symbol('DefaultValue');

/** @class Represents a column definition. */
export class Column<T = any, TName extends TypeName = TypeName> {
	declare [$ColumnType]: T;
	declare [ColumnType]: TName;
	declare [IsPrimaryKey]?: boolean;
	declare [IsAutoInc]?: boolean;
	declare [IsOptional]?: boolean;
	declare [IsIndexed]?: boolean;
	declare [IsUnique]?: boolean;
	declare [DefaultValue]?: T;

	constructor(type: TName) {
		this[ColumnType] = type;
	}

	/** @instance Marks column as primary key */
	pk() {
		this[IsPrimaryKey] = true;
		return this as this & { [IsPrimaryKey]: true };
	}

	/** @instance Marks column as unique */
	unique() {
		this[IsIndexed] = true;
		this[IsUnique] = true;

		return this as this & {
			[IsIndexed]: true;
			[IsUnique]: true;
		};
	}

	/** @instance Enables auto increment - only available for numeric columns */
	auto(): T extends number ? this & { [IsAutoInc]: true } : Omit<this, 'auto'> {
		const colType = this[ColumnType];

		const allowedTypes = ['int', 'integer', 'float', 'number'] as TypeName[];

		if (!isNonEmptyString(colType) || !allowedTypes.includes(colType)) {
			throw new Error(`auto() can only be used with number columns, got: ${colType}`);
		}

		this[IsAutoInc] = true;

		return this as T extends number ? this & { [IsAutoInc]: true } : Omit<this, 'auto'>;
	}

	/** @instance Marks column as indexed */
	index() {
		this[IsIndexed] = true;
		return this as this & { [IsIndexed]: true };
	}

	/** @instance Sets default value for the column */
	default<Default extends T>(value: Default) {
		this[DefaultValue] = value;
		return this as this & { [DefaultValue]: Default };
	}

	/** @instance Marks column as optional */
	optional() {
		this[IsOptional] = true;
		return this as this & { [IsOptional]: true };
	}
}

/** @class Represents a table. */
export class Table<C extends ColumnDefinition = ColumnDefinition> {
	readonly name: string;
	readonly columns: C;

	constructor(name: string, columns: C) {
		this.name = name;
		this.columns = columns;
	}
}
