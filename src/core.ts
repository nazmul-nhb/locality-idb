import { isNonEmptyString } from 'nhb-toolbox';
import type { ColumnDefinition, TypeName, ValidatorFn } from './types';

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
/** Symbol key for nullable (null) marker */
export const IsNullable = Symbol('IsNullable');
/** Symbol key for indexed marker */
export const IsIndexed = Symbol('IsIndexed');
/** Symbol key for unique marker */
export const IsUnique = Symbol('IsUnique');
/** Symbol key for default value */
export const DefaultValue = Symbol('DefaultValue');
/** Symbol key for custom validation function */
export const ValidateFn = Symbol('ValidateFn');

/** @class Represents a column definition. */
export class Column<T = any, TName extends TypeName = TypeName> {
	declare [$ColumnType]: T;
	declare [ColumnType]: TName;
	declare [IsPrimaryKey]?: boolean;
	declare [IsAutoInc]?: boolean;
	declare [IsOptional]?: boolean;
	declare [IsNullable]?: boolean;
	declare [IsIndexed]?: boolean;
	declare [IsUnique]?: boolean;
	declare [DefaultValue]?: T;
	declare [ValidateFn]?: (value: T) => string | null | undefined;

	constructor(type: TName) {
		this[ColumnType] = type;
	}

	/** @instance Marks column as primary key */
	pk() {
		this[IsPrimaryKey] = true;
		return this as this & { [IsPrimaryKey]: true };
	}

	/**
	 * @instance Marks column as unique
	 *
	 * @remarks Also marks the column as indexed
	 */
	unique() {
		this[IsIndexed] = true;
		this[IsUnique] = true;

		return this as this & {
			[IsIndexed]: true;
			[IsUnique]: true;
		};
	}

	/** @instance Enables auto increment - only available for numeric columns */
	auto() {
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

	/**
	 * @instance Sets a custom validation function for the column
	 *
	 * @param validator - Custom validation function that receives the value and returns `null`/`undefined` if valid, or an error message `string` if invalid
	 *
	 * @returns The column instance with the validation function attached
	 *
	 * @remarks
	 * - Custom validation is not applied to auto-generated values (e.g. auto-increment, UUID, timestamp). But default values are validated if {@link default()} is used.
	 * - If multiple validators are chained, only the last one is used.
	 * - Built-in type validation still applies to all other columns without custom validators.
	 * - If the column is optional, the validator is only called when a value is provided (not `undefined`).
	 *
	 * @example
	 * // Email validation
	 * email: text().validate((val) => {
	 *   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? null : 'Invalid email format';
	 * })
	 *
	 * // Range validation
	 * age: int().validate((val) => {
	 *   return val >= 0 && val <= 120 ? null : 'Age must be between 0 and 120';
	 * })
	 */
	validate(validator: ValidatorFn<T>) {
		this[ValidateFn] = validator;
		return this as this & { [ValidateFn]: typeof validator };
	}

	// TODO: Implement nullable support in the future
	// nullable() {
	// 	this[IsNullable] = true;
	// 	return this as this & { [IsNullable]: true };
	// }
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
