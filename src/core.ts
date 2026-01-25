import type { ColumnDefinition, ColumnTypeSymbol } from './types';

/**
 * Represents a column definition.
 */
export class Column<T extends any = any> {
	readonly type: string;
	readonly primaryKey?: boolean;
	readonly autoIncrement?: boolean;
	readonly optional?: boolean;
	readonly indexed?: boolean;
	readonly defaultValue?: T;

	declare readonly [ColumnTypeSymbol]: T;

	constructor(type: string) {
		this.type = type;
	}

	/** Marks column as primary key */
	pk() {
		return Object.assign(this, { primaryKey: true }) as this & { primaryKey: true };
	}

	/** Enables auto increment - only available for numeric columns */
	// auto(): this extends Column<number> & { primaryKey: true } ? this & { autoIncrement: true }
	auto(): T extends number ? this & { autoIncrement: true }
	:	Omit<this, 'auto' | 'autoIncrement'> {
		if (
			typeof this.type !== 'string' ||
			!['int', 'integer', 'float', 'number'].includes(this.type.toLowerCase())
		) {
			throw new Error(`auto() can only be used with integer columns, got: ${this.type}`);
		}

		return Object.assign(this, { autoIncrement: true }) as any;
	}

	/** Adds an index */
	index() {
		return Object.assign(this, { indexed: true }) as this & { indexed: true };
	}

	default<D extends T>(value: D) {
		return Object.assign(this, { defaultValue: value }) as this & { defaultValue: D };
	}

	partial() {
		return Object.assign(this, { optional: true }) as this & { optional: true };
	}
}

/**
 * Represents a table.
 */
export class Table<T extends ColumnDefinition = ColumnDefinition> {
	readonly name: string;
	readonly columns: T;

	constructor(name: string, columns: T) {
		this.name = name;
		this.columns = columns;
	}
}
