import {
	extractNumbers,
	isArray,
	isBigInt,
	isBoolean,
	isDate,
	isInteger,
	isMap,
	isNumber,
	isNumericString,
	isObject,
	isSet,
	isString,
	isUUID,
} from 'nhb-toolbox';
import { type Column, ColumnType, DefaultValue } from './core';
import type { ColumnDefinition, GenericObject, TypeName } from './types';
import { getTimestamp, isTimestamp, uuidV4 } from './utils';

/**
 * * Validate if a value matches the specified column data type
 * @param type The column data type
 * @param value The value to validate
 * @returns `null` if valid, otherwise an error message string
 */
export function validateColumnType<T extends TypeName>(type: T, value: unknown): string | null {
	const strVal = JSON.stringify(value);

	switch (type) {
		case 'int':
			if (isInteger(type)) return null;

			return `'${strVal}' is not an integer`;

		case 'float':
		case 'number':
			if (isNumber(value)) return null;

			return `'${strVal}' is not a ${type === 'float' ? 'float ' : ''}number`;

		case 'numeric':
			if (isNumericString(value) || isNumber(value)) return null;

			return `'${strVal}' is not a numeric value`;

		case 'bigint':
			if (isBigInt(value)) return null;

			return `'${strVal}' is not a bigint`;

		case 'text':
		case 'string':
			if (isString(value)) return null;

			return `'${strVal}' is not a ${type === 'text' ? 'text ' : ''}string`;

		case 'timestamp':
			if (isTimestamp(value)) return null;

			return `'${strVal}' is not a timestamp string`;

		case 'uuid':
			if (isUUID(value)) return null;

			return `'${strVal}' is not a UUID string`;

		case 'bool':
		case 'boolean':
			if (isBoolean(value)) return null;

			return `'${strVal}' is not a boolean`;

		case 'array':
			if (isArray(value)) return null;

			return `'${strVal}' is not an array`;

		case 'list':
			if (isArray(value)) return null;

			return `'${strVal}' is not a list`;

		case 'tuple':
			if (isArray(value)) return null;

			return `'${strVal}' is not a tuple`;

		case 'set':
			if (isSet(value)) return null;

			return `'${strVal}' is not a set`;

		case 'object':
			if (isObject(value)) return null;

			return `'${strVal}' is not an object`;

		case 'date':
			if (isDate(value)) return null;

			return `'${strVal}' is not a Date object`;

		case 'map':
			if (isMap(value)) return null;

			return `'${strVal}' is not a Map object`;

		case 'custom':
			return null;

		default: {
			const length = extractNumbers(type)[0];

			if (type.startsWith('varchar(')) {
				if (isString(value)) {
					if (isNumber(length) && value.length <= length) return null;

					return `'${strVal}' does not satisfy the constraint: varchar length ${length}`;
				}

				return `'${strVal}' is not a varchar string`;
			}

			if (type.startsWith('char(')) {
				if (isString(value)) {
					if (isNumber(length) && value.length === length) return null;

					return `'${strVal}' does not satisfy the constraint: char length ${length}`;
				}

				return `'${strVal}' is not a char string`;
			}

			return null;
		}
	}
}

/**
 * * Validate and prepare data for insertion or update based on column definitions
 *
 * @param data The data object to validate and prepare
 * @param columns The column definitions
 * @param keyPath The key path of the primary key column (if any)
 * @param forUpdate Whether the operation is an update (default: `false`)
 *
 * @returns The validated and prepared data object
 * @throws {TypeError} If any value does not match the expected column type
 */
export function validateAndPrepareData<Data extends GenericObject>(
	data: Data,
	columns: ColumnDefinition | undefined,
	keyPath: string | undefined,
	forUpdate = false
): Data {
	type Key = keyof Data;

	const prepared = { ...data };

	if (columns) {
		Object.entries(columns).forEach((entry) => {
			const [fieldName, column] = entry as [Key, Column];

			const defaultValue = column[DefaultValue];

			if (!(fieldName in prepared) && defaultValue !== undefined && !forUpdate) {
				prepared[fieldName] = defaultValue;
			}

			const columnType = column[ColumnType];

			if (columnType === 'uuid' && !(fieldName in prepared) && !forUpdate) {
				prepared[fieldName] = uuidV4() as Data[Key];
			}

			if (columnType === 'timestamp' && !(fieldName in prepared) && !forUpdate) {
				prepared[fieldName] = getTimestamp() as Data[Key];
			}

			if (fieldName !== keyPath) {
				const errorMsg = validateColumnType(columnType, prepared[fieldName]);

				if (errorMsg) throw new TypeError(errorMsg);
			}
		});
	}

	return prepared;
}
