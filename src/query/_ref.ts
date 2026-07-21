import { ColumnType, IsNullable, IsOptional, IsPrimaryKey, RefMeta } from '../symbols';
import type { GenericObject, Maybe, RefOptions, SchemaDefinition } from '../types';

/**
 * @internal Private interface for managing relationships between tables
 */
export interface RefRelation {
	childTable: string;
	childColumn: string;
	targetTable: string;
	targetColumn: string;
	options?: RefOptions;
}

/**
 * @internal Private function for getting reference relations
 * @param schema The schema definition
 * @param tableName The table name
 * @returns Array of reference relations
 */
function getRefRelations(schema: Maybe<SchemaDefinition>, tableName: string): RefRelation[] {
	if (!schema) return [];

	const relations: RefRelation[] = [];

	for (const [childTable, childTableDef] of Object.entries(schema)) {
		for (const [columnName, column] of Object.entries(childTableDef.columns)) {
			const refMeta = column[RefMeta];

			if (!refMeta) continue;

			const [targetTable, targetColumn] = refMeta.refPath.split('.');

			if (targetTable === tableName) {
				relations.push({
					childTable,
					childColumn: columnName,
					targetTable,
					targetColumn,
					options: refMeta.options,
				});
			}
		}
	}

	return relations;
}

/**
 * @internal Private function for getting reference workflow tables
 * @param schema The schema definition
 * @param tableName The table name
 * @returns Array of reference workflow tables
 */
export function getRefWorkflowTables(schema: Maybe<SchemaDefinition>, tableName: string) {
	const tables = new Set<string>([tableName]);

	for (const relation of getRefRelations(schema, tableName)) {
		tables.add(relation.childTable);
	}

	return [...tables];
}

/**
 * @internal Private function for getting referenced target tables for a table
 * @param schema The schema definition
 * @param tableName The table name
 * @returns Array of target table names
 */
export function getRefTargetTables(schema: Maybe<SchemaDefinition>, tableName: string) {
	const tables = new Set<string>([tableName]);

	const table = schema?.[tableName];

	if (!table) return [...tables];

	for (const column of Object.values(table.columns)) {
		const refMeta = column[RefMeta];

		if (!refMeta) continue;

		const [targetTable] = refMeta.refPath.split('.');

		if (targetTable) {
			tables.add(targetTable);
		}
	}

	return [...tables];
}

/**
 * @internal Private function for getting primary key name
 * @param schema The schema definition
 * @param tableName The table name
 * @returns Primary key name
 */
function getPrimaryKeyName(schema: Maybe<SchemaDefinition>, tableName: string) {
	const table = schema?.[tableName];

	if (!table) return undefined;

	const pkEntry = Object.entries(table.columns).find(([_, column]) => column[IsPrimaryKey]);

	return pkEntry?.[0];
}

/**
 * @internal Private function for checking if column can be set to null
 * @param schema The schema definition
 * @param tableName The table name
 * @param columnName The column name
 * @returns Boolean indicating if column can be set to null
 */
function canSetNull(schema: Maybe<SchemaDefinition>, tableName: string, columnName: string) {
	const column = schema?.[tableName]?.columns?.[columnName];

	return {
		setNull: column?.[IsNullable],
		makeOptional: column?.[IsOptional],
	};
}

/**
 * @internal Private function for getting rows by value
 * @param transaction The transaction
 * @param tableName The table name
 * @param columnName The column name
 * @param value The value
 * @returns Array of rows
 */
function getRowsByValue(
	transaction: IDBTransaction,
	tableName: string,
	columnName: string,
	value: unknown
) {
	return new Promise<GenericObject[]>((resolve, reject) => {
		const store = transaction.objectStore(tableName);
		const request = store.getAll() as IDBRequest<GenericObject[]>;

		request.onsuccess = () => {
			resolve(request.result.filter((row) => row[columnName] === value));
		};

		request.onerror = () => reject(request.error);
	});
}

/**
 * @internal Private function for deleting rows by primary key
 * @param transaction The transaction
 * @param tableName The table name
 * @param rows The rows to delete
 * @param schema The schema definition
 * @returns Promise
 */
function deleteRowsByPrimaryKey(
	transaction: IDBTransaction,
	tableName: string,
	rows: GenericObject[],
	schema: Maybe<SchemaDefinition>
) {
	const keyName = getPrimaryKeyName(schema, tableName);

	if (!keyName) {
		return Promise.resolve();
	}

	return Promise.all(
		rows.map((row) => {
			return new Promise<void>((resolve, reject) => {
				const store = transaction.objectStore(tableName);
				const request = store.delete(row[keyName]);

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		})
	);
}

/**
 * @internal Private function for updating rows by column
 * @param transaction The transaction
 * @param tableName The table name
 * @param rows The rows to update
 * @param columnName The column name
 * @param value The value
 */
function updateRowsByColumn(
	transaction: IDBTransaction,
	tableName: string,
	rows: GenericObject[],
	columnName: string,
	value: unknown
) {
	return Promise.all(
		rows.map((row) => {
			return new Promise<void>((resolve, reject) => {
				const store = transaction.objectStore(tableName);
				const request = store.put({ ...row, [columnName]: value });

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		})
	);
}

/**
 * Applies the insert referential integrity workflow
 * @param schema The schema definition
 * @param tableName The table name
 * @param rows The rows to insert
 * @param transaction The transaction
 */
export async function applyInsertRefWorkflow(
	schema: Maybe<SchemaDefinition>,
	tableName: string,
	rows: GenericObject[],
	transaction: IDBTransaction
) {
	if (!schema || rows.length === 0) return;

	const table = schema[tableName];

	if (!table) return;

	for (const row of rows) {
		for (const [columnName, column] of Object.entries(table.columns)) {
			const refMeta = column[RefMeta];

			if (!refMeta) continue;

			const value = row[columnName];

			if (value == null) continue;

			const [targetTable, targetColumn] = refMeta.refPath.split('.');
			const targetColumnDefinition = schema?.[targetTable]?.columns?.[targetColumn];

			if (!targetColumnDefinition) {
				throw new Error(
					`Cannot resolve reference '${refMeta.refPath}' for '${tableName}.${columnName}'.`
				);
			}

			const sourceType = column[ColumnType];
			const targetType = targetColumnDefinition[ColumnType];

			if (sourceType !== targetType) {
				throw new Error(
					`Cannot insert row into '${tableName}' because '${tableName}.${columnName}' has type '${sourceType}' but '${targetTable}.${targetColumn}' has type '${targetType}'.`
				);
			}

			const relatedRows = await getRowsByValue(
				transaction,
				targetTable,
				targetColumn,
				value
			);

			if (relatedRows.length === 0) {
				throw new Error(
					`Cannot insert row into '${tableName}' because '${tableName}.${columnName}' references '${targetTable}.${targetColumn}' value '${String(value)}' that does not exist.`
				);
			}
		}
	}
}

/**
 * Applies the delete referential integrity workflow
 * @param schema The schema definition
 * @param tableName The table name
 * @param rows The rows to delete
 * @param transaction The transaction
 */
export async function applyDeleteRefWorkflow(
	schema: Maybe<SchemaDefinition>,
	tableName: string,
	rows: GenericObject[],
	transaction: IDBTransaction
) {
	if (!schema || rows.length === 0) return;

	const relations = getRefRelations(schema, tableName);

	for (const relation of relations) {
		const { childColumn, childTable, targetColumn, options } = relation;

		const targetValues = rows
			.map((row) => row[targetColumn])
			.filter((value) => value !== undefined && value !== null);

		for (const value of new Set(targetValues)) {
			const relatedRows = await getRowsByValue(
				transaction,
				childTable,
				childColumn,
				value
			);

			if (relatedRows.length === 0) continue;

			const action = options?.onDelete ?? 'noAction';

			switch (action) {
				case 'cascade': {
					await applyDeleteRefWorkflow(schema, childTable, relatedRows, transaction);

					await deleteRowsByPrimaryKey(transaction, childTable, relatedRows, schema);

					break;
				}

				case 'restrict': {
					throw new Error(
						`Cannot delete row from '${tableName}' because '${childTable}.${childColumn}' has a restrict reference.`
					);
				}

				case 'setNull/Undefined': {
					const { setNull, makeOptional } = canSetNull(
						schema,
						childTable,
						childColumn
					);

					if (!setNull && !makeOptional) {
						throw new Error(
							`Cannot set null/undefined for '${childTable}.${childColumn}' because the column is not nullable or optional.`
						);
					}

					await updateRowsByColumn(
						transaction,
						childTable,
						relatedRows,
						childColumn,
						setNull ? null : undefined
					);

					break;
				}
				default:
					break;
			}
		}
	}
}

/**
 * Applies the update referential integrity workflow
 * @param schema The schema definition
 * @param tableName The table name
 * @param currentRow The current row
 * @param updatedRow The updated row
 * @param transaction The transaction
 */
export async function applyUpdateRefWorkflow(
	schema: Maybe<SchemaDefinition>,
	tableName: string,
	currentRow: GenericObject,
	updatedRow: GenericObject,
	transaction: IDBTransaction
) {
	if (!schema) return;

	const relations = getRefRelations(schema, tableName);

	for (const relation of relations) {
		const { childColumn, childTable, targetColumn, options } = relation;

		const oldValue = currentRow[targetColumn];
		const newValue = updatedRow[targetColumn];

		if (oldValue === newValue || newValue === undefined || newValue === null) continue;

		const relatedRows = await getRowsByValue(
			transaction,
			childTable,
			childColumn,
			oldValue
		);

		if (relatedRows.length === 0) continue;

		const action = options?.onUpdate ?? 'noAction';

		switch (action) {
			case 'cascade': {
				await updateRowsByColumn(
					transaction,
					childTable,
					relatedRows,
					childColumn,
					newValue
				);
				break;
			}
			case 'restrict': {
				throw new Error(
					`Cannot update row in '${tableName}' because '${childTable}.${childColumn}' has a restrict reference.`
				);
			}
			case 'setNull/Undefined': {
				const { setNull, makeOptional } = canSetNull(schema, childTable, childColumn);

				if (!setNull && !makeOptional) {
					throw new Error(
						`Cannot set null/undefined for '${childTable}.${childColumn}' because the column is not nullable or optional.`
					);
				}

				await updateRowsByColumn(
					transaction,
					childTable,
					relatedRows,
					childColumn,
					setNull ? null : undefined
				);
				break;
			}
			default:
				break;
		}
	}
}
