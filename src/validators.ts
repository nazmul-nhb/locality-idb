import {
	extractNumbers,
	isArray,
	isBigInt,
	isBoolean,
	isDate,
	isFunction,
	isInteger,
	isMap,
	isNumber,
	isNumericString,
	isObject,
	isSet,
	isString,
	isUndefined,
	isUUID,
} from 'nhb-toolbox';
import {
	type Column,
	ColumnType,
	DefaultValue,
	IsAutoInc,
	IsOptional,
	ValidateFn,
} from './core';
import type { ColumnDefinition, GenericObject, Maybe, TypeName } from './types';
import { getTimestamp, isEmail, isTimestamp, isURL, uuidV4 } from './utils';

/**
 * * Validate if a value matches the specified column data type
 * @param type The column data type
 * @param value The value to validate
 * @returns `null` if valid, otherwise an error message string
 */
export function validateColumnType<T extends TypeName>(type: T, value: unknown): string | null {
	const strVal = isString(value) ? JSON.stringify(value) : `'${JSON.stringify(value)}'`;

	switch (type) {
		case 'int':
			if (isInteger(value)) return null;

			return `${strVal} is not an integer`;

		case 'float':
		case 'number':
			if (isNumber(value)) return null;

			return `${strVal} is not a ${type === 'float' ? 'float ' : ''}number`;

		case 'numeric':
			if (isNumericString(value) || isNumber(value)) return null;

			return `${strVal} is not a numeric value`;

		case 'bigint':
			if (isBigInt(value)) return null;

			return `${strVal} is not a bigint`;

		case 'text':
		case 'string':
			if (isString(value)) return null;

			return `${strVal} is not a ${type === 'text' ? 'text ' : ''}string`;

		case 'email':
			if (isEmail(value)) return null;

			return `${strVal} is not a valid email address`;

		case 'url':
			if (isURL(value)) return null;

			return `${strVal} is not a valid URL string`;

		case 'timestamp':
			if (isTimestamp(value)) return null;

			return `${strVal} is not a timestamp string`;

		case 'uuid':
			if (isUUID(value)) return null;

			return `${strVal} is not a UUID string`;

		case 'bool':
		case 'boolean':
			if (isBoolean(value)) return null;

			return `${strVal} is not a boolean`;

		case 'array':
			if (isArray(value)) return null;

			return `${strVal} is not an array`;

		case 'list':
			if (isArray(value)) return null;

			return `${strVal} is not a list`;

		case 'tuple':
			if (isArray(value)) return null;

			return `${strVal} is not a tuple`;

		case 'object':
			if (isObject(value)) return null;

			return `${strVal} is not an object`;

		case 'date':
			if (isDate(value)) return null;

			return `${strVal} is not a Date object`;

		case 'set':
			if (isSet(value)) return null;

			return `${strVal} is not a set`;

		case 'map':
			if (isMap(value)) return null;

			return `${strVal} is not a Map object`;

		case 'custom':
			return null;

		default: {
			const length = extractNumbers(type)[0];

			if (type.startsWith('varchar(')) {
				if (isString(value)) {
					if (isNumber(length) && value.length <= length) return null;

					return `${strVal} does not satisfy the constraint: varchar length ${length}`;
				}

				return `${strVal} is not a varchar string`;
			}

			if (type.startsWith('char(')) {
				if (isString(value)) {
					if (isNumber(length) && value.length === length) return null;

					return `${strVal} does not satisfy the constraint: char length ${length}`;
				}

				return `${strVal} is not a char string`;
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
 * @param tableName The name of the table
 * @param forUpdate Whether the operation is an update (default: `false`)
 *
 * @returns The validated and prepared data object
 * @throws
 * - A {@link TypeError} if any value does not match the expected column type
 * - A {@link RangeError} if any field is not defined in the table schema or required field is missing
 */
export function validateAndPrepareData<Data extends GenericObject>(
	data: Data,
	columns: Maybe<ColumnDefinition>,
	keyPath: Maybe<string>,
	tableName: string,
	forUpdate = false
): Data {
	type Key = keyof Data;

	const prepared = { ...data };

	if (columns) {
		// ! Validate that all provided fields exist in schema
		for (const fieldName of Object.keys(prepared)) {
			if (!Object.keys(columns).includes(fieldName)) {
				throw new RangeError(
					`Field '${fieldName}' is not defined in the table '${tableName}' schema!`
				);
			}
		}

		// ! Process each column
		Object.entries(columns).forEach((entry) => {
			const [fieldName, column] = entry as [Key, Column];

			const columnType = column[ColumnType];
			const defaultValue = column[DefaultValue];
			const isOptional = column[IsOptional] ?? false;

			let fieldNotPresent = !(fieldName in prepared);

			// ! Auto-generate values for insert (not update)
			if (!forUpdate && fieldNotPresent) {
				// Auto-generate UUID
				if (columnType === 'uuid' && isUndefined(defaultValue)) {
					prepared[fieldName] = uuidV4() as Data[Key];
					return; // Skip validation for auto-generated
				}

				// Auto-generate timestamp
				if (columnType === 'timestamp' && isUndefined(defaultValue)) {
					prepared[fieldName] = getTimestamp() as Data[Key];
					return; // Skip validation for auto-generated
				}

				// Apply default value
				if (!isUndefined(defaultValue)) {
					prepared[fieldName] = defaultValue;
					fieldNotPresent = false; // Update flag after applying default
				}
			}

			// Recalculate field value after potential auto-generation/default
			const fieldValue = prepared[fieldName];

			// ! Handle missing fields
			if (fieldNotPresent) {
				// For updates, missing fields are OK (partial update)
				if (forUpdate) return;

				// For inserts, check if field is required
				if (!isOptional && fieldName !== keyPath) {
					throw new RangeError(
						`Required field '${String(fieldName)}' is missing in table '${tableName}'!`
					);
				}

				// Optional field can be omitted
				return;
			}

			// ! Handle undefined values
			if (isUndefined(fieldValue)) {
				// Undefined is only allowed for optional fields
				if (!isOptional && fieldName !== keyPath) {
					throw new TypeError(
						`Field '${String(fieldName)}' in table '${tableName}' cannot be undefined. It is a required field.`
					);
				}

				return; // Skip validation for undefined optional fields
			}

			// ! Validate the value type
			// Skip validation for primary key during inserts ONLY if auto-increment
			const shouldSkip =
				!forUpdate && fieldName === keyPath && (column[IsAutoInc] ?? false);

			if (!shouldSkip) {
				const customValidator = column[ValidateFn];
				let errorMsg: string | null | undefined;

				// Use custom validator if provided, otherwise use built-in validation
				if (isFunction(customValidator)) {
					errorMsg = customValidator(fieldValue);
				} else {
					errorMsg = validateColumnType(columnType, fieldValue);
				}

				if (errorMsg) {
					throw new TypeError(
						`Invalid value for field '${String(fieldName)}' in table '${tableName}': ${errorMsg}`
					);
				}
			}
		});
	}

	return prepared;
}
