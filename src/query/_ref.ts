import { isString } from 'toolbox-x/guards';
import type { Column } from '../core';
import { ColumnType, IsNullable, IsOptional, IsPrimaryKey, RefMeta } from '../symbols';
import type { GenericObject, Maybe, RefOptions, SchemaDefinition } from '../types';

type ActionMode = 'insert' | 'update' | 'delete';

export interface RefRelation {
	childTable: string;
	childColumn: string;
	targetTable: string;
	targetColumn: string;
	options?: RefOptions;
}

interface RefPathInfo {
	schema: Maybe<SchemaDefinition>;
	column: Column;
	refPath: string;
	mode: ActionMode;
	tableName: string;
	columnName: string;
}

function actionMsgPrefix(mode: ActionMode) {
	switch (mode) {
		case 'insert':
			return 'insert row into';
		case 'update':
			return 'update row in';
		case 'delete':
			return 'delete row from';
	}
}

function throwSelfRefError(mode: ActionMode, opts: Omit<RefRelation, 'options'>): never {
	const { childColumn, childTable, targetColumn, targetTable } = opts || {};

	throw new ReferenceError(
		`Cannot ${actionMsgPrefix(mode)} '${targetTable}' because '${childTable}.${childColumn}' references back to its own column '${targetTable}.${targetColumn}'.`
	);
}

function processRefPath(info: RefPathInfo) {
	const { refPath, schema, column, tableName, columnName, mode } = info;
	const [targetTable, targetColumn] = refPath.split('.');

	const targetColumnDef = schema?.[targetTable]?.columns?.[targetColumn];

	if (!targetColumnDef) {
		throw new ReferenceError(
			`Cannot resolve reference '${refPath}' for '${tableName}.${columnName}'.`
		);
	}

	const sourceType = column[ColumnType];
	const targetType = targetColumnDef[ColumnType];

	if (sourceType !== targetType) {
		throw new TypeError(
			`Cannot ${actionMsgPrefix(mode)} '${tableName}' because '${tableName}.${columnName}' has type '${sourceType}' but '${targetTable}.${targetColumn}' has type '${targetType}'.`
		);
	}

	return { targetTable, targetColumn };
}

/**
 * @internal Private function for getting reference relations
 * @param schema The schema definition
 * @param tableName The table name
 * @returns Array of reference relations
 */
function getRefRelations(
	schema: Maybe<SchemaDefinition>,
	tableName: string,
	mode: ActionMode
): RefRelation[] {
	if (!schema) return [];

	const relations: RefRelation[] = [];

	for (const [childTable, childTableDef] of Object.entries(schema)) {
		for (const [columnName, column] of Object.entries(childTableDef.columns)) {
			const refMeta = column[RefMeta];

			if (!refMeta) continue;

			const { refPath, options } = refMeta;

			const { targetTable, targetColumn } = processRefPath({
				refPath,
				schema,
				column,
				mode,
				tableName,
				columnName,
			});

			if (targetTable === tableName) {
				relations.push({
					childTable,
					childColumn: columnName,
					targetTable,
					targetColumn,
					options,
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
export function getRefWorkflowTables(
	schema: Maybe<SchemaDefinition>,
	tableName: string,
	mode: ActionMode
) {
	const tables = new Set<string>([tableName]);
	const queue = [tableName];

	while (queue.length > 0) {
		const currentTable = queue.shift();

		if (!currentTable) continue;

		for (const relation of getRefRelations(schema, currentTable, mode)) {
			if (!tables.has(relation.childTable)) {
				tables.add(relation.childTable);
				queue.push(relation.childTable);
			}
		}
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
 * @param trx The transaction
 * @param tableName The table name
 * @param columnName The column name
 * @param value The value
 * @returns Array of rows
 */
function getRowsByValue(
	trx: IDBTransaction,
	tableName: string,
	columnName: string,
	value: unknown
) {
	return new Promise<GenericObject[]>((resolve, reject) => {
		const store = trx.objectStore(tableName);
		const request = store.getAll() as IDBRequest<GenericObject[]>;

		request.onsuccess = () => {
			resolve(request.result.filter((row) => row[columnName] === value));
		};

		request.onerror = () => reject(request.error);
	});
}

/**
 * @internal Private function for deleting rows by primary key
 * @param trx The transaction
 * @param tableName The table name
 * @param rows The rows to delete
 * @param schema The schema definition
 * @returns Promise
 */
function deleteRowsByPrimaryKey(
	trx: IDBTransaction,
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
				const store = trx.objectStore(tableName);
				const request = store.delete(row[keyName]);

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		})
	);
}

/**
 * @internal Private function for updating rows by column
 * @param trx The transaction
 * @param tableName The table name
 * @param rows The rows to update
 * @param columnName The column name
 * @param value The value
 */
function updateRowsByColumn(
	trx: IDBTransaction,
	tableName: string,
	rows: GenericObject[],
	columnName: string,
	value: unknown
) {
	return Promise.all(
		rows.map((row) => {
			return new Promise<void>((resolve, reject) => {
				const store = trx.objectStore(tableName);
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
 * @param trx The transaction
 */
export async function applyInsertRefWorkflow(
	schema: Maybe<SchemaDefinition>,
	tableName: string,
	rows: GenericObject[],
	trx: IDBTransaction
) {
	if (!schema || rows.length === 0) return;

	const table = schema[tableName];

	if (!table) return;

	for (const row of rows) {
		for (const [columnName, column] of Object.entries(table.columns)) {
			const refMeta = column[RefMeta];

			if (!refMeta) continue;

			const { targetTable, targetColumn } = processRefPath({
				refPath: refMeta.refPath,
				schema,
				mode: 'insert',
				column,
				tableName,
				columnName,
			});

			if (tableName === targetTable) {
				throwSelfRefError('insert', {
					childTable: tableName,
					childColumn: columnName,
					targetTable,
					targetColumn,
				});
			}

			const value = row[columnName];

			if (value == null) continue;

			const relatedRows = await getRowsByValue(trx, targetTable, targetColumn, value);

			if (relatedRows.length === 0) {
				const strVal = `'${isString(value) ? value : JSON.stringify(value)}'`;

				throw new ReferenceError(
					`Cannot insert row into '${tableName}' because '${tableName}.${columnName}' references '${targetTable}.${targetColumn}' value ${strVal} that does not exist.`
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
 * @param trx The transaction
 */
export async function applyDeleteRefWorkflow(
	schema: Maybe<SchemaDefinition>,
	tableName: string,
	rows: GenericObject[],
	trx: IDBTransaction
) {
	if (!schema || rows.length === 0) return;

	const relations = getRefRelations(schema, tableName, 'delete');

	for (const relation of relations) {
		const { childColumn, childTable, targetColumn, targetTable, options } = relation;

		if (childTable === targetTable) {
			throwSelfRefError('delete', {
				childTable,
				childColumn,
				targetTable,
				targetColumn,
			});
		}

		const targetValues = rows.map((row) => row[targetColumn]).filter((v) => v != null);

		for (const value of new Set(targetValues)) {
			const relatedRows = await getRowsByValue(trx, childTable, childColumn, value);

			if (relatedRows.length === 0) continue;

			switch (options?.onDelete) {
				case 'cascade': {
					await applyDeleteRefWorkflow(schema, childTable, relatedRows, trx);

					await deleteRowsByPrimaryKey(trx, childTable, relatedRows, schema);

					break;
				}

				case 'restrict': {
					throw new ReferenceError(
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
						throw new TypeError(
							`Cannot set null/undefined for '${childTable}.${childColumn}' because the column is not nullable or optional.`
						);
					}

					await updateRowsByColumn(
						trx,
						childTable,
						relatedRows,
						childColumn,
						setNull ? null : undefined
					);

					break;
				}
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
 * @param trx The transaction
 */
export async function applyUpdateRefWorkflow(
	schema: Maybe<SchemaDefinition>,
	tableName: string,
	currentRow: GenericObject,
	updatedRow: GenericObject,
	trx: IDBTransaction
) {
	if (!schema) return;

	const relations = getRefRelations(schema, tableName, 'update');

	for (const relation of relations) {
		const { childColumn, childTable, targetColumn, targetTable, options } = relation;

		if (childTable === targetTable) {
			throwSelfRefError('update', {
				childTable,
				childColumn,
				targetTable,
				targetColumn,
			});
		}

		const oldValue = currentRow[targetColumn];
		const newValue = updatedRow[targetColumn];

		if (oldValue === newValue || newValue == null) continue;

		const relatedRows = await getRowsByValue(trx, childTable, childColumn, oldValue);

		if (relatedRows.length === 0) continue;

		switch (options?.onUpdate) {
			case 'cascade': {
				await updateRowsByColumn(trx, childTable, relatedRows, childColumn, newValue);
				break;
			}

			case 'restrict': {
				throw new ReferenceError(
					`Cannot update row in '${tableName}' because '${childTable}.${childColumn}' has a restrict reference.`
				);
			}

			case 'setNull/Undefined': {
				const { setNull, makeOptional } = canSetNull(schema, childTable, childColumn);

				if (!setNull && !makeOptional) {
					throw new TypeError(
						`Cannot set null/undefined for '${childTable}.${childColumn}' because the column is not nullable or optional.`
					);
				}

				await updateRowsByColumn(
					trx,
					childTable,
					relatedRows,
					childColumn,
					setNull ? null : undefined
				);

				break;
			}
		}
	}
}
