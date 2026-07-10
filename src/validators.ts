import { extractNumbers } from 'toolbox-x';
import {
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
} from 'toolbox-x/guards';
import type { Column } from './core';
import {
	ColumnType,
	DefaultValue,
	IsAutoInc,
	IsNullable,
	IsOptional,
	OnUpdate,
	ValidateFn,
} from './symbols';
import type {
	ColumnDefinition,
	GenericObject,
	Maybe,
	Nullable,
	TypeName,
	Uncertain,
} from './types';
import { getTimestamp, isEmail, isTimestamp, isURL, uuidV4 } from './utils';

/**
 * * Validate if a value matches the specified column data type
 * @param type The column data type
 * @param value The value to validate
 * @returns `null` if valid, otherwise an error message string
 */
export function validateColumnType<T extends TypeName>(
	type: T,
	value: unknown
): Nullable<string> {
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
			const [length] = extractNumbers(type);

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
export function _validateAndPrepareData<Data extends GenericObject>(
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
			const isNullable = column[IsNullable] ?? false;
			const isAutoInc = column[IsAutoInc] ?? false;
			const onUpdate = column[OnUpdate];

			const skipAutoGen = isNullable || isOptional;

			let fieldNotPresent = !(fieldName in prepared);

			// ! Auto-generate values for insert (not update)
			if (!forUpdate && fieldNotPresent) {
				// Auto-generate UUID
				if (columnType === 'uuid' && isUndefined(defaultValue) && !skipAutoGen) {
					prepared[fieldName] = uuidV4() as Data[Key];
					return; // Skip validation for auto-generated
				}

				// Auto-generate timestamp
				if (columnType === 'timestamp' && isUndefined(defaultValue) && !skipAutoGen) {
					prepared[fieldName] = getTimestamp() as Data[Key];
					return; // Skip validation for auto-generated
				}

				// Apply default value
				if (!isUndefined(defaultValue)) {
					prepared[fieldName] = defaultValue;
					fieldNotPresent = false; // Update flag after applying default
				}
			}

			// ! Apply onUpdate function for updates
			if (forUpdate && isFunction(onUpdate)) {
				prepared[fieldName] = onUpdate(prepared[fieldName]);
				fieldNotPresent = false; // Update flag after applying onUpdate
			}

			// ! Set null for nullable fields if null (or undefined) is provided
			if (prepared[fieldName] == null && isNullable) {
				prepared[fieldName] = null as Data[Key];
				return; // Set null for nullable fields
			}

			// ! Handle missing fields
			if (fieldNotPresent) {
				// For updates, missing fields are OK (partial update)
				if (forUpdate && !isFunction(onUpdate)) return;

				// For inserts, check if field is required
				if (!(isOptional || isNullable) && fieldName !== keyPath) {
					throw new RangeError(
						`Required field '${String(fieldName)}' is missing in table '${tableName}'!`
					);
				}

				return; // Optional field can be omitted
			}

			// ! Handle undefined values
			if (isUndefined(prepared[fieldName])) {
				// Undefined is only allowed for optional and nullable fields
				if (!(isOptional || isNullable) && fieldName !== keyPath) {
					throw new TypeError(
						`Field '${String(fieldName)}' in table '${tableName}' cannot be undefined. It is a required field.`
					);
				}

				return; // Skip validation for undefined optional fields
			}

			// ! Validate the value type
			// Skip validation for primary key during inserts ONLY if auto-increment
			const shouldSkip = !forUpdate && fieldName === keyPath && isAutoInc;

			if (!shouldSkip) {
				const customValidator = column[ValidateFn];
				let errorMsg: Uncertain<string>;

				// Use custom validator if provided, otherwise use built-in validation
				if (isFunction(customValidator)) {
					errorMsg = customValidator(prepared[fieldName]);
				} else {
					errorMsg = validateColumnType(columnType, prepared[fieldName]);
				}

				if (isString(errorMsg)) {
					throw new TypeError(
						`Invalid value for field '${String(fieldName)}' in table '${tableName}': ${errorMsg}`
					);
				}
			}
		});
	}

	return prepared;
}
