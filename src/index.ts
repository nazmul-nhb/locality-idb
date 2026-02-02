export type * from './types';

// ! Export only class types to avoid unexpected side effects
export type { Column, PKColumn, Table } from './core';

export { Locality } from './client';
export { openDBWithStores } from './factory';
export { column, defineSchema, table } from './schema';
export { deleteDB, getTimestamp, isEmail, isTimestamp, isURL, isUUID, uuidV4 } from './utils';
export { validateColumnType } from './validators';

// ! Export symbols for advanced usage
export {
	ColumnType,
	DefaultValue,
	IsAutoInc,
	IsIndexed,
	IsNullable,
	IsOptional,
	IsPrimaryKey,
	IsUnique,
	OnUpdate,
	ValidateFn,
} from './core';
