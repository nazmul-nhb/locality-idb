import { IsAutoInc, IsPrimaryKey } from './core';
import { DeleteQuery, InsertQuery, SelectQuery, UpdateQuery } from './query';
import type {
	$InferRow,
	InferInsertType,
	InferSelectType,
	LocalityConfig,
	SchemaDefinition,
	StoreConfig,
} from './types';
import { openDBWithStores } from './utils';

/**
 * Locality database instance.
 */
export class Locality<
	DBName extends string = string,
	Version extends number = number,
	Schema extends SchemaDefinition = SchemaDefinition,
> {
	readonly #name: DBName;
	readonly #version: Version;
	readonly #schema: Schema;

	#db!: IDBDatabase;
	#readyPromise: Promise<void>;

	constructor(config: LocalityConfig<DBName, Version, Schema>) {
		this.#name = config.dbName;
		this.#version = config.version;
		this.#schema = config.schema;

		const store = this.#buildStoresConfig();

		this.#readyPromise = openDBWithStores(this.#name, this.#version, store).then((db) => {
			this.#db = db;
		});
	}

	/**
	 * Build store configurations from schema.
	 */
	#buildStoresConfig(): StoreConfig[] {
		return Object.entries(this.#schema).map(([tableName, table]) => {
			const columns = table.columns;
			const pk = Object.values(columns).find((col) => col[IsPrimaryKey]);

			const autoInc = pk?.[IsAutoInc] || false;
			const pkName = Object.entries(columns).find(([_, col]) => col[IsPrimaryKey])?.[0];

			// if (!pkName) {
			// 	throw new Error(`Table "${tableName}" must have a primary key column.`);
			// }

			// const defaultValue = Object.values(columns).filter(
			// 	(col) => col.defaultValue !== undefined
			// );

			return {
				name: tableName,
				keyPath: pkName,
				autoIncrement: autoInc,
			};
		});
	}

	/**
	 * Waits for database initialization to complete.
	 */
	async ready(): Promise<void> {
		return this.#readyPromise;
	}

	/**
	 * Select records from a table.
	 */
	from<T extends keyof Schema, Row extends $InferRow<Schema[T]['columns']>>(
		table: T
	): SelectQuery<Row, null> {
		return new SelectQuery<Row, null>(table as string, () => this.#db, this.#readyPromise);
	}

	/**
	 * Insert record into a table.
	 */
	insert<
		T extends keyof Schema,
		Raw extends InferInsertType<Schema[T]>,
		Inserted,
		Data extends InferSelectType<Schema[T]>,
		Return extends Inserted extends Array<infer _> ? Data[] : Data,
	>(table: T): InsertQuery<Raw, Inserted, Data, Return> {
		return new InsertQuery<Raw, Inserted, Data, Return>(
			table as string,
			() => this.#db,
			this.#readyPromise,
			this.#schema[table].columns
		);
	}

	/**
	 * Update records.
	 */
	update<T extends keyof Schema, Row extends $InferRow<Schema[T]['columns']>>(
		table: T
	): UpdateQuery<Row, Schema[T]> {
		return new UpdateQuery<Row, Schema[T]>(
			table as string,
			() => this.#db,
			this.#readyPromise
		);
	}

	/**
	 * Delete records.
	 */
	delete<T extends keyof Schema, Row extends $InferRow<Schema[T]['columns']>>(
		table: T
	): DeleteQuery<Row, keyof Row> {
		const columns = this.#schema[table].columns;
		const keyField = Object.entries(columns).find(
			([_, col]) => (col as any)[IsPrimaryKey]
		)?.[0];

		return new DeleteQuery<Row, keyof Row>(
			table as string,
			() => this.#db,
			this.#readyPromise,
			keyField as keyof Row
		);
	}
}
