import { DeleteQuery, InsertQuery, SelectQuery, UpdateQuery } from './query';
import type {
	$InferRow,
	InferInsertType,
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
	readonly #defaultValue?: $InferRow<Schema[keyof Schema]['columns']>;

	#db!: IDBDatabase;
	#readyPromise: Promise<void>;

	constructor(config: LocalityConfig<DBName, Version, Schema>) {
		this.#name = config.dbName;
		this.#version = config.version;
		this.#schema = config.schema;

		const store = this.#buildStoresConfig();

		this.#defaultValue;

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
			const pk = Object.values(columns).find((col) => col.primaryKey);

			const autoInc = pk?.autoIncrement || false;
			const pkName = Object.entries(columns).find(([_, col]) => col.primaryKey)?.[0];

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
	select<T extends keyof Schema>(table: T) {
		return new SelectQuery<$InferRow<Schema[T]['columns']>>(
			table as string,
			() => this.#db,
			this.#readyPromise
		);
	}

	/**
	 * Insert record into a table.
	 */
	insert<T extends keyof Schema>(table: T) {
		return new InsertQuery<InferInsertType<Schema[T]>>(
			table as string,
			() => this.#db,
			this.#readyPromise,
			this.#schema[table].columns
		);
	}

	/**
	 * Update records.
	 */
	update<T extends keyof Schema>(table: T) {
		return new UpdateQuery<$InferRow<Schema[T]['columns']>, Schema[T]>(
			table as string,
			() => this.#db,
			this.#readyPromise
		);
	}

	/**
	 * Delete records.
	 */
	delete<T extends keyof Schema>(table: T) {
		const columns = this.#schema[table].columns;
		const keyField = Object.entries(columns).find(([_, col]) => col.primaryKey)?.[0];

		return new DeleteQuery<$InferRow<Schema[T]['columns']>>(
			table as string,
			() => this.#db,
			this.#readyPromise,
			keyField as string
		);
	}
}
