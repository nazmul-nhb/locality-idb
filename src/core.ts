import { isNonEmptyString } from 'nhb-toolbox';
import type { ColumnDefinition, TypeName, UpdaterFn, ValidatorFn } from './types';

/** Symbol key for column data type */
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
/** Symbol key for on update marker */
export const OnUpdate = Symbol('OnUpdate');

/** @class Represents a column definition. */
export class Column<T = any, TName extends TypeName = TypeName> {
	declare [ColumnType]: TName;
	declare [IsPrimaryKey]?: boolean;
	declare [IsAutoInc]?: boolean;
	declare [IsOptional]?: boolean;
	declare [IsNullable]?: boolean;
	declare [IsIndexed]?: boolean;
	declare [IsUnique]?: boolean;
	declare [DefaultValue]?: T;
	declare [ValidateFn]?: ValidatorFn<T>;
	declare [OnUpdate]?: UpdaterFn<T>;

	constructor(type: TName) {
		this[ColumnType] = type;
	}

	/**
	 * @instance Marks column as primary key
	 *
	 * @returns The {@link PKColumn column instance} marked as primary key
	 *
	 */
	pk() {
		this[IsPrimaryKey] = true;
		// return this as this & { [IsPrimaryKey]: true };

		return new PKColumn<T, TName>(this[ColumnType], this) as TName extends (
			'int' | 'integer' | 'float' | 'number'
		) ?
			this & PKColumn<T, TName> & { [IsPrimaryKey]: true }
		:	this & Omit<PKColumn<T, TName>, 'auto'> & { [IsPrimaryKey]: true };
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
	 * email: column.text().validate((val) => {
	 *   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? null : 'Invalid email format';
	 * })
	 *
	 * // Range validation
	 * age: column.int().validate((val) => {
	 *   return val >= 0 && val <= 120 ? null : 'Age must be between 0 and 120';
	 * })
	 */
	validate(validator: ValidatorFn<T>) {
		this[ValidateFn] = validator;
		return this as this & { [ValidateFn]: ValidatorFn<T> };
	}

	/**
	 * @instance Sets an updater function that modifies the column value on updates
	 * @param updater - Updater function that receives the current value and returns the new value
	 * @returns The column instance with the updater function attached
	 *
	 * @remarks
	 * - The updater function is called automatically during update operations.
	 * - **Important**: It overrides any value provided during updates.
	 * - It receives the current value of the column and should return the updated value.
	 * - This is useful for fields like `"updatedAt"` timestamps that need to be refreshed on each update.
	 * - If multiple updaters are chained, only the last one is used.
	 *
	 * @example
	 * // Automatically update timestamp on record modification
	 * updatedAt: column.timestamp().onUpdate(() => getTimestamp());
	 *
	 * // Increment a version number on each update
	 * version: column.int().default(1).onUpdate((current) => (current ?? 0) + 1);
	 *
	 * // Append to a log array on each update
	 * log: column.array<string>().default([]).onUpdate((current) => [...(current ?? []), getTimestamp()]);
	 *
	 * // Note: Ensure the column is not marked as primary key or auto-increment when using onUpdate
	 */
	onUpdate(updater: UpdaterFn<T>) {
		this[OnUpdate] = updater;
		return this as this & { [OnUpdate]: UpdaterFn<T> };
	}

	// TODO: Implement nullable support in the future
	// nullable() {
	// 	this[IsNullable] = true;
	// 	return this as this & { [IsNullable]: true };
	// }
}

/** @class Extends {@link Column} and represents a primary key column. */
export class PKColumn<T = any, TName extends TypeName = TypeName> extends Column<T, TName> {
	constructor(type: TName, column: Column<T, TName>) {
		super(type);

		this[ColumnType] = column[ColumnType];

		this[IsPrimaryKey] = true;
		this[IsAutoInc] = column[IsAutoInc];
		this[IsOptional] = column[IsOptional];
		this[IsNullable] = column[IsNullable];
		this[IsIndexed] = column[IsIndexed];
		this[IsUnique] = column[IsUnique];
		this[DefaultValue] = column[DefaultValue];
		this[ValidateFn] = column[ValidateFn];
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
}

/** @class Represents a table definition. */
export class Table<C extends ColumnDefinition = ColumnDefinition> {
	readonly name: string;
	readonly columns: C;

	constructor(name: string, columns: C) {
		this.name = name;
		this.columns = columns;
	}
}
