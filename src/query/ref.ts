import { IsNullable, IsOptional, IsPrimaryKey, RefMeta } from '../symbols';
import type { GenericObject, Maybe, RefOptions, SchemaDefinition } from '../types';

export interface RefRelation {
	childTable: string;
	childColumn: string;
	targetTable: string;
	targetColumn: string;
	options?: RefOptions;
}

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

export function getRefWorkflowTables(schema: Maybe<SchemaDefinition>, tableName: string) {
	const tables = new Set<string>([tableName]);

	for (const relation of getRefRelations(schema, tableName)) {
		tables.add(relation.childTable);
	}

	return [...tables];
}

function getPrimaryKeyName(schema: Maybe<SchemaDefinition>, tableName: string) {
	const table = schema?.[tableName];

	if (!table) return undefined;

	const pkEntry = Object.entries(table.columns).find(([_, column]) => column[IsPrimaryKey]);

	return pkEntry?.[0];
}

function canSetNull(schema: Maybe<SchemaDefinition>, tableName: string, columnName: string) {
	const column = schema?.[tableName]?.columns?.[columnName];

	return {
		setNull: column?.[IsNullable],
		makeOptional: column?.[IsOptional],
	};
}

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

export async function applyDeleteRefWorkflow(
	schema: Maybe<SchemaDefinition>,
	tableName: string,
	rows: GenericObject[],
	transaction: IDBTransaction
) {
	if (!schema || rows.length === 0) return;

	const relations = getRefRelations(schema, tableName);

	for (const relation of relations) {
		const targetValues = rows
			.map((row) => row[relation.targetColumn])
			.filter((value) => value !== undefined && value !== null);

		for (const value of new Set(targetValues)) {
			const relatedRows = await getRowsByValue(
				transaction,
				relation.childTable,
				relation.childColumn,
				value
			);

			if (relatedRows.length === 0) continue;

			const action = relation.options?.onDelete ?? 'noAction';

			switch (action) {
				case 'cascade': {
					await applyDeleteRefWorkflow(
						schema,
						relation.childTable,
						relatedRows,
						transaction
					);

					await deleteRowsByPrimaryKey(
						transaction,
						relation.childTable,
						relatedRows,
						schema
					);

					break;
				}
				case 'restrict': {
					throw new Error(
						`Cannot delete row from '${tableName}' because '${relation.childTable}.${relation.childColumn}' has a restrict reference.`
					);
				}
				case 'setNull': {
					const { setNull, makeOptional } = canSetNull(
						schema,
						relation.childTable,
						relation.childColumn
					);

					if (!setNull && !makeOptional) {
						throw new Error(
							`Cannot set null for '${relation.childTable}.${relation.childColumn}' because the column is not nullable or optional.`
						);
					}

					await updateRowsByColumn(
						transaction,
						relation.childTable,
						relatedRows,
						relation.childColumn,
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
		const oldValue = currentRow[relation.targetColumn];
		const newValue = updatedRow[relation.targetColumn];

		if (oldValue === newValue || newValue === undefined || newValue === null) continue;

		const relatedRows = await getRowsByValue(
			transaction,
			relation.childTable,
			relation.childColumn,
			oldValue
		);

		if (relatedRows.length === 0) continue;

		const action = relation.options?.onUpdate ?? 'noAction';

		switch (action) {
			case 'cascade': {
				await updateRowsByColumn(
					transaction,
					relation.childTable,
					relatedRows,
					relation.childColumn,
					newValue
				);
				break;
			}
			case 'restrict': {
				throw new Error(
					`Cannot update row in '${tableName}' because '${relation.childTable}.${relation.childColumn}' has a restrict reference.`
				);
			}
			case 'setNull': {
				const { setNull, makeOptional } = canSetNull(
					schema,
					relation.childTable,
					relation.childColumn
				);

				if (!setNull && !makeOptional) {
					throw new Error(
						`Cannot set null for '${relation.childTable}.${relation.childColumn}' because the column is not nullable or optional.`
					);
				}

				await updateRowsByColumn(
					transaction,
					relation.childTable,
					relatedRows,
					relation.childColumn,
					setNull ? null : undefined
				);
				break;
			}
			default:
				break;
		}
	}
}
