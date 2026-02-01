# Locality IDB

> **SQL**-like query builder for `IndexedDB` with `Drizzle`-style API

<!-- markdownlint-disable-file MD024 -->

<div align="center">

![npm version](https://img.shields.io/npm/v/locality-idb?color=blue)
![npm downloads](https://img.shields.io/npm/dm/locality-idb)
![bundle size](https://deno.bundlejs.com/badge?q=locality-idb)
![license](https://img.shields.io/npm/l/locality-idb)
<!-- ![beta](https://img.shields.io/badge/status-beta-orange) -->
<!-- ![bundle](https://img.shields.io/bundlephobia/minzip/locality-idb) -->
<!-- ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue) -->

[API Reference](#-api-reference) • [Examples](#-usage) • [Contributing](CONTRIBUTING.md)

</div>

---

## Why Locality IDB?

[**IndexedDB**](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) is a powerful browser-native database, but its low-level API can be cumbersome and complex to work with. `Locality IDB` simplifies `IndexedDB` interactions by providing a modern, type-safe, and SQL-like query builder inspired by [**Drizzle ORM**](https://github.com/drizzle-team/drizzle-orm).

---

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Core Concepts](#-core-concepts)
  - [Schema Definition](#schema-definition)
  - [Column Types](#column-types)
  - [Type Inference](#type-inference)
- [Usage](#-usage)
  - [Initialize Database](#initialize-database)
  - [Insert Records](#insert-records)
  - [Select/Query Records](#selectquery-records)
  - [Update Records](#update-records)
  - [Delete Records](#delete-records)
- [API Reference](#-api-reference)
  - [Locality Class](#locality-class)
  - [Schema Functions](#schema-functions)
  - [Column Modifiers](#column-modifiers)
  - [Query Methods](#query-methods)
  - [Utility Functions](#utility-functions)
  - [Validation](#validation)
- [Type System](#-type-system)
- [License](#-license)

---

## ✨ Features

- 🎯 **Type-Safe**: Full TypeScript support with automatic type inference
- 🔍 **SQL-like Queries**: Familiar query syntax inspired by Drizzle ORM
- 🚀 **Modern API**: Clean and intuitive interface for IndexedDB operations
- 📦 **Zero Dependencies**: Lightweight with only development dependencies
- 🔄 **Auto-Generation**: Automatic UUID and timestamp generation
- 🎨 **Schema-First**: Define your database schema with a simple, declarative API
- ⚡ **Promise-Based**: Fully async/await compatible
- 🛠️ **Rich Column Types**: Support for various data types including custom types
- ✅ **Built-in Validation**: Automatic data type validation for built-in column types during insert and update operations

---

## 📦 Installation

```bash
# npm
npm install locality-idb

# pnpm
pnpm add locality-idb

# yarn
yarn add locality-idb
```

---

## 🚀 Quick Start

```typescript
import { Locality, defineSchema, column } from 'locality-idb';

// Define your schema
const schema = defineSchema({
  users: {
    id: column.int().pk().auto(),
    name: column.text(),
    email: column.text().unique(),
    createdAt: column.timestamp(),
  },
  posts: {
    id: column.int().pk().auto(),
    userId: column.int().index(),
    title: column.varchar(255),
    content: column.text(),
    createdAt: column.timestamp(),
  },
});

// Initialize database
const db = new Locality({
  dbName: 'my-app-db',
  version: 1,
  schema,
});

// Wait for database to be ready (optional)
await db.ready();

// Insert data
const user = await db
  .insert('users')
  .values({
    name: 'Alice',
    email: 'alice@example.com',
  })
  .run();

// Query data
const users = await db.from('users').findAll();
const alice = await db
  .from('users')
  .where((user) => user.email === 'alice@example.com')
  .findFirst();

// Update data
await db
  .update('users')
  .set({ name: 'Alice Wonderland' })
  .where((user) => user.id === 1)
  .run();

// Delete data
await db
  .delete('users')
  .where((user) => user.id === 1)
  .run();
```

---

## 🧩 Core Concepts

### Schema Definition

Define your database schema using the `defineSchema` function:

```typescript
import { defineSchema, column } from 'locality-idb';

const schema = defineSchema({
  tableName: {
    columnName: column.type().modifier(),
    // ... more columns
  },
  // ... more tables
});
```

> **Important:** Each table must have **exactly one** primary key defined using `.pk()`. Having zero or multiple primary keys will result in a runtime error.

```typescript
// ✅ Valid - single primary key
const validSchema = defineSchema({
  users: {
    id: column.int().pk().auto(),
    name: column.text(),
  },
});

// ❌ Invalid - no primary key (runtime error)
const noPkSchema = defineSchema({
  users: {
    name: column.text(),
  },
});

// ❌ Invalid - multiple primary keys (runtime error)
const multiPkSchema = defineSchema({
  users: {
    id: column.int().pk(),
    uuid: column.uuid().pk(), // Error!
    name: column.text(),
  },
});
```

### Column Types

Locality IDB supports a wide range of column types:

| Type                   | Description                                                | Example                            |
| ---------------------- | ---------------------------------------------------------- | ---------------------------------- |
| `number()` / `float()` | Numeric values (integer or float)                          | `column.int()`                     |
| `int()`                | Numeric values (only integer is allowed)                   | `column.int()`                     |
| `numeric()`            | Number or numeric string                                   | `column.numeric()`                 |
| `bigint()`             | Large integers                                             | `column.bigint()`                  |
| `text()` / `string()`  | Text strings                                               | `column.text()`                    |
| `char(length?)`        | Fixed-length string                                        | `column.char(10)`                  |
| `varchar(length?)`     | Variable-length string                                     | `column.varchar(255)`              |
| `bool()` / `boolean()` | Boolean values                                             | `column.bool()`                    |
| `date()`               | Date objects                                               | `column.date()`                    |
| `timestamp()`          | ISO 8601 timestamps ([auto-generated](#utility-functions)) | `column.timestamp()`               |
| `uuid()`               | UUID strings ([auto-generated](#utility-functions) v4)     | `column.uuid()`                    |
| `object<T>()`          | Generic objects                                            | `column.object<UserData>()`        |
| `array<T>()`           | Arrays                                                     | `column.array<number>()`           |
| `list<T>()`            | Read-only arrays                                           | `column.list<string>()`            |
| `tuple<T>()`           | Fixed-size tuples                                          | `column.tuple<[string, number]>()` |
| `set<T>()`             | Sets                                                       | `column.set<string>()`             |
| `map<K,V>()`           | Maps                                                       | `column.map<string, number>()`     |
| `custom<T>()`          | Custom types                                               | `column.custom<MyType>()`          |

### Type Inference

Locality IDB provides powerful type inference utilities:

```typescript
import type { InferSelectType, InferInsertType, InferUpdateType } from 'locality-idb';

const schema = defineSchema({
  users: {
    id: column.int().pk().auto(),
    name: column.text(),
    email: column.text().unique(),
    age: column.int().optional(),
    createdAt: column.timestamp(),
  },
});

// Infer types from schema
type User = InferSelectType<typeof schema.users>;
// { id: number; name: string; email: string; age?: number; createdAt: string }

type InsertUser = InferInsertType<typeof schema.users>;
// { name: string; email: string; age?: number; id?: number; createdAt?: string }

type UpdateUser = InferUpdateType<typeof schema.users>;
// { name?: string; email?: string; age?: number; createdAt?: string }
```

---

## 💻 Usage

### Initialize Database

```typescript
import { Locality, defineSchema, column } from 'locality-idb';

const schema = defineSchema({
  users: {
    id: column.int().pk().auto(),
    name: column.text(),
    email: column.text().unique(),
  },
});

const db = new Locality({
  dbName: 'my-database',
  version: 1,
  schema,
});

// Optional: Wait for database initialization
await db.ready();
```

### Insert Records

#### Single Insert

```typescript
const user = await db
  .insert('users')
  .values({
    name: 'John Doe',
    email: 'john@example.com',
  })
  .run();

console.log(user); // { id: 1, name: 'John Doe', email: 'john@example.com' }
```

#### Batch Insert

```typescript
const users = await db
  .insert('users')
  .values([
    { name: 'Alice', email: 'alice@example.com' },
    { name: 'Bob', email: 'bob@example.com' },
  ])
  .run();

console.log(users); // Array of inserted users
```

#### Auto-Generated Values

```typescript
const schema = defineSchema({
  posts: {
    id: column.uuid().pk(),
    title: column.text(),
    createdAt: column.timestamp(),
    isPublished: column.bool().default(false),
  },
});

const post = await db
  .insert('posts')
  .values({ title: 'My First Post' })
  .run();

// id and createdAt are auto-generated, isPublished defaults to false
console.log(post);
// {
//   id: "550e8400-e29b-41d4-a716-446655440000",
//   title: "My First Post",
//   createdAt: "2026-01-29T12:34:56.789Z",
//   isPublished: false
// }
```

### Select/Query Records

#### Get All Records

```typescript
const allUsers = await db.from('users').findAll();
```

#### Filter with Where

```typescript
// Predicate-based filtering (in-memory)
const admins = await db
  .from('users')
  .where((user) => user.role === 'admin')
  .findAll();

const activeUsers = await db
  .from('users')
  .where((user) => user.isActive && user.age >= 18)
  .findAll();

// Index-based filtering (optimized) - requires index or primary key
const usersByEmail = await db
  .from('users')
  .where('email', 'alice@example.com')
  .findAll();

// Range queries with IDBKeyRange
const adults = await db
  .from('users')
  .where('age', IDBKeyRange.bound(18, 65))
  .findAll();
```

#### Select Specific Columns

```typescript
// Include only specified columns
const userNames = await db
  .from('users')
  .select({ name: true, email: true })
  .findAll();
// Returns: Array<{ name: string; email: string }>

// Exclude specified columns
const usersWithoutPassword = await db
  .from('users')
  .select({ password: false })
  .findAll();
// Returns: Array<Omit<User, 'password'>>
```

#### Order By

```typescript
const sortedUsers = await db
  .from('users')
  .orderBy('name', 'asc') // or 'desc'
  .findAll();

// Supports nested keys
const sorted = await db
  .from('users')
  .orderBy('profile.age', 'desc')
  .findAll();
```

#### Limit Results

```typescript
const topTenUsers = await db
  .from('users')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .findAll();
```

#### Get First Match

```typescript
const user = await db
  .from('users')
  .where((user) => user.email === 'john@example.com')
  .findFirst();
// Returns: User | null
```

#### Find by Primary Key

```typescript
// Optimized O(1) lookup using IndexedDB's get()
const user = await db.from('users').findByPk(1);
// Returns: User | null

// Works with select projection
const userName = await db
  .from('users')
  .select({ name: true, email: true })
  .findByPk(1);
// Returns: { name: string; email: string } | null
```

#### Find by Index

```typescript
// Find records using an indexed field (optimized index query)
const usersByEmail = await db
  .from('users')
  .findByIndex('email', 'alice@example.com');
// Returns: User[]

// Find by numeric index
const youngUsers = await db
  .from('users')
  .findByIndex('age', 25);
// Returns: User[]

// Works with all query modifiers
const result = await db
  .from('users')
  .select({ name: true, age: true })
  .findByIndex('age', 30)
  .where((user) => user.isActive)
  .limit(5);
```

#### Sort by Index

```typescript
// Optimized cursor-based sorting (no in-memory sort needed!)
const sortedUsers = await db
  .from('users')
  .sortByIndex('age', 'desc')
  .findAll();

// Combine with limit for efficient pagination
const topTenOldest = await db
  .from('users')
  .sortByIndex('age', 'desc')
  .limit(10)
  .findAll();

// Works with select projection
const names = await db
  .from('users')
  .select({ name: true, age: true })
  .sortByIndex('age', 'asc')
  .findAll();
```

> **Note:** `sortByIndex()` uses IndexedDB cursor iteration for optimal performance when `where()` filter is applied without index.

#### Chain Multiple Methods

```typescript
const result = await db
  .from('users')
  .select({ id: true, name: true, email: true })
  .where((user) => user.age >= 18)
  .orderBy('name', 'asc')
  .limit(5)
  .findAll();
```

### Update Records

```typescript
// Update with condition
const updatedCount = await db
  .update('users')
  .set({ name: 'Jane Doe', age: 30 })
  .where((user) => user.id === 1)
  .run();

console.log(`Updated ${updatedCount} records`);

// Update all matching records
await db
  .update('users')
  .set({ isActive: false })
  .where((user) => user.lastLogin < '2025-01-01')
  .run();
```

### Delete Records

```typescript
// Delete with condition
const deletedCount = await db
  .delete('users')
  .where((user) => user.id === 1)
  .run();

console.log(`Deleted ${deletedCount} records`);

// Delete multiple records
await db
  .delete('users')
  .where((user) => user.isDeleted === true)
  .run();
```

---

## 📚 API Reference

### Locality Class

#### Constructor

```typescript
new Locality<DBName, Version, Schema>(config: LocalityConfig)
```

**Parameters:**

- `config.dbName`: Database name (string)
- `config.version`: Database version (optional, default: 1)
- `config.schema`: Schema definition object

**Example:**

```typescript
const db = new Locality({
  dbName: 'my-database',
  version: 1,
  schema: mySchema,
});
```

#### Methods

##### `ready(): Promise<void>`

Waits for database initialization to complete.

```typescript
await db.ready();
```

##### `from<T>(table: T): SelectQuery<T>`

Creates a SELECT query for the specified table.

```typescript
const query = db.from('users');
```

##### `insert<T>(table: T): InsertQuery<T>`

Creates an INSERT query for the specified table.

```typescript
const query = db.insert('users');
```

##### `update<T>(table: T): UpdateQuery<T>`

Creates an UPDATE query for the specified table.

```typescript
const query = db.update('users');
```

##### `delete<T>(table: T): DeleteQuery<T>`

Creates a DELETE query for the specified table.

```typescript
const query = db.delete('users');
```

#### `clearTable<T>(table: T): Promise<void>`

Clears all records from the specified table.

```typescript
await db.clearTable('users');
```

> **Warning:** This will remove all data and cannot be undone.

#### `deleteDB(): Promise<void>`

Deletes the entire database (current database).

> **Note:** This method uses the `deleteDB` utility function internally and closes the database connection before deletion.

```typescript
await db.deleteDB();
```

> **Warning:** This will remove all data and cannot be undone.

#### `close(): void`

Closes the database connection.

```typescript
db.close();
```

#### `getDBInstance(): Promise<IDBDatabase>`

Gets the underlying `IDBDatabase` instance.

```typescript
const idb = await db.getDBInstance();
```

#### `seed<T>(table: T, data: InferInsertType<Schema[T]>[]): Promise<InferSelectType<Schema[T]>[]>`

Inserts seed data into the specified table.

> **Note:**
>
> - This is a convenience method for inserting initial data.
> - It uses the `insert` method internally.
> - It does not clear existing data before inserting.
> - Accepts only an **array** of records (for single record insertion, use `insert().values().run()`)

**Parameters:**

- `table`: Table name
- `data`: Array of records to insert

**Returns:** Array of inserted record(s)

**Example:**

```typescript
await db.seed('users', [
  { name: 'Alice', email: 'alice@wonderland.mad', },
  { name: 'Bob', email: 'bob@top.com', },
]);

const allUsers = await db.from('users').findAll();

console.log(allUsers);
```

---

### Schema Functions

#### `defineSchema<Schema extends ColumnRecord, Keys extends keyof Schema>(schema: Schema): SchemaRecord<Schema, Keys>`

Defines a database schema from an object mapping table names to column definitions.

**Parameters:**

- `schema`: Object with table names as keys and column definitions as values

**Returns:** Schema object with typed tables

**Example:**

```typescript
const schema = defineSchema({
  users: {
    id: column.int().pk().auto(),
    name: column.text(),
  },
  posts: {
    id: column.int().pk().auto(),
    title: column.text(),
  },
});
```

#### `table<T>(name: string, columns: T): Table<T>`

Creates a single table definition (alternative to `defineSchema`).

**Parameters:**

- `name`: Table name
- `columns`: Column definitions object

**Returns:** Table instance

**Example:**

```typescript
const userTable = table('users', {
  id: column.int().pk().auto(),
  name: column.text(),
});
```

---

### Column Modifiers

All column types support the following modifiers:

#### `pk(): Column`

Marks the column as the primary key.

```typescript
column.int().pk()
```

#### `auto(): Column`

Enables auto-increment (only for numeric columns: `int`, `float`, `number`).

```typescript
column.int().pk().auto()
```

#### `unique(): Column`

Marks the column as unique and creates an index.

```typescript
column.text().unique()
```

#### `index(): Column`

Creates an index on the column.

```typescript
column.int().index()
```

#### `optional(): Column`

Makes the column optional (nullable).

```typescript
column.text().optional()
```

#### `default<T>(value: T): Column`

Sets a default value for the column.

```typescript
column.bool().default(true)
column.text().default('N/A')
```

#### `validate(validator: (value: T) => string | null | undefined): Column`

Adds custom validation logic to the column. The validation function receives the column value and should return:

- `null` or `undefined` if the value is valid
- An error message `string` if the value is invalid

**When it runs:** During insert and update operations, before data is saved to `IndexedDB`.

> **Error Handling:** If validation fails, a `TypeError` is thrown with details about the invalid field.

**Precedence:** Custom validators override built-in type validation. If you provide a custom validator, the built-in type check for that column will be skipped.

> **Note:**
>
> - Custom validation is not applied to auto-generated values (e.g. auto-increment, UUID, timestamp). But default values are validated if `.default(value)` is used.
> - If multiple validators are chained, only the last one is used.
> - Built-in type validation still applies to all other columns without custom validators.
> - If the column is optional, the validator is only called when a value is provided (not `undefined`).

```typescript
// Email validation
const schema = defineSchema({
  users: {
    id: column.int().pk().auto(),
    email: column.text().validate((val) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(val) ? null : 'Invalid email format';
    }),
    age: column.int().validate((val) => {
      if (val < 0) return 'Age cannot be negative';
      if (val > 120) return 'Age must be 120 or less';
      return null; // Valid
    }),
    username: column.text().validate((val) => {
      if (val.length < 3) return 'Username must be at least 3 characters';
      if (!/^[a-zA-Z0-9_]+$/.test(val)) return 'Username can only contain letters, numbers, and underscores';
      return null;
    }),
  },
});

// ✅ Valid insert
await db.insert('users').values({
  email: 'user@example.com',
  age: 25,
  username: 'john_doe'
}).run();

// ❌ Throws TypeError: Invalid value for field 'email' in table 'users': Invalid email format
await db.insert('users').values({
  email: 'invalid-email',
  age: 25,
  username: 'john_doe'
}).run();

// ❌ Throws TypeError: Invalid value for field 'age' in table 'users': Age cannot be negative
await db.insert('users').values({
  email: 'user@example.com',
  age: -5,
  username: 'john_doe'
}).run();
```

**Combining with `.optional()`:**

```typescript
const schema = defineSchema({
  users: {
    id: column.int().pk().auto(),
    // Custom validation only runs when value is provided
    bio: column.text().optional().validate((val) => {
      return val.length <= 500 ? null : 'Bio must be 500 characters or less';
    }),
  },
});

// ✅ Valid - bio is optional and omitted
await db.insert('users').values({}).run();

// ✅ Valid - bio is provided and valid
await db.insert('users').values({ bio: 'Short bio' }).run();

// ❌ Throws TypeError - bio provided but exceeds 500 chars
await db.insert('users').values({ bio: 'x'.repeat(501) }).run();
```

**Access the `ValidateFn` symbol (advanced):**

```typescript
import { ValidateFn } from 'locality-idb';

// Access validator function programmatically
const emailColumn = column.text().validate((val) => { /* ... */ });
const validatorFn = emailColumn[ValidateFn]; // Function reference
```

---

### Query Methods

#### SelectQuery Methods

##### `select<Selection>(columns: Selection): SelectQuery`

Selects or excludes specific columns.

```typescript
// Include specific columns
db.from('users').select({ name: true, email: true })

// Exclude specific columns
db.from('users').select({ password: false })
```

##### `where(predicate: (row: T) => boolean): SelectQuery`

Filters rows based on a predicate function.

```typescript
db.from('users').where((user) => user.age >= 18)
```

##### `where<IdxKey>(indexName: IdxKey, query: T[IdxKey] | IDBKeyRange): SelectQuery`

Filters rows using an indexed field or primary key.

**Type Safety:** `indexName` must be either an indexed field or the primary key.

**Performance:** Uses IndexedDB's optimized index/key query for efficient lookups.

```typescript
// Using an indexed field
db.from('users').where('age', IDBKeyRange.bound(18, 30))

// Using primary key
db.from('users').where('id', IDBKeyRange.bound(1, 100))
```

##### `sortByIndex<IdxKey>(indexName: IdxKey, dir?: 'asc' | 'desc'): SelectQuery`

Sorts results by an indexed field using IndexedDB cursor iteration (avoiding in-memory sorting).

**Type Safety:** `indexName` must be a field with an index or the primary key.

**Performance:** Uses IndexedDB's cursor for optimized sorting. For large datasets, this is significantly more efficient than in-memory sorting.

> For sorting on non-indexed fields, use [`orderBy()`](#orderbykeykey-key-direction-asc--desc-selectquery) which performs in-memory sorting.

```typescript
// Optimized cursor-based sort
const sorted = await db.from('users').sortByIndex('age', 'desc').findAll();

// Efficient pagination
const page = await db.from('users').sortByIndex('createdAt', 'desc').limit(20).findAll();
```

##### `orderBy<Key>(key: Key, direction?: 'asc' | 'desc'): SelectQuery`

Orders results by a specified key. Supports nested keys using dot notation.

```typescript
db.from('users').orderBy('name', 'asc')
db.from('users').orderBy('profile.age', 'desc')
```

> **Note:** This method performs in-memory sorting. For large datasets, consider using [`sortByIndex()`](#sortbyindexidxkeyindexname-idxkey-dir-asc--desc-selectquery) with an indexed field for better performance.

##### `limit(count: number): SelectQuery`

Limits the number of results.

```typescript
db.from('users').limit(10)
```

##### `findAll(): Promise<T[]>`

Fetches all matching records.

```typescript
const users = await db.from('users').findAll()
```

##### `findFirst(): Promise<T | null>`

Fetches the first matching record.

```typescript
const user = await db.from('users').findFirst()
```

##### `findByPk<Key>(key: Key): Promise<T | null>`

Finds a single record by its primary key value using IndexedDB's optimized `get()` method.

**Performance:** `O(1)` lookup

```typescript
const user = await db.from('users').findByPk(1);
const post = await db.from('posts').findByPk('some-uuid-string');
```

##### `findByIndex<IdxKey>(indexName: IdxKey, query: T[IdxKey] | IDBKeyRange): Promise<T[]>`

Finds records using an indexed field. Only accepts field names that are marked with `.index()` or `.unique()`.

**Type Safety:** `indexName` must be a field with an index.

**Performance:** Uses IndexedDB's index query for optimized lookups.

```typescript
// Type-safe: 'email' must be indexed
const users = await db.from('users').findByIndex('email', 'alice@example.com');

// Works with IDBKeyRange for range queries
const adults = await db.from('users').findByIndex('age', IDBKeyRange.bound(18, 65));
```

> **Note:**
>
> - Unique columns are automatically indexed.
> - Unique indexes are recommended for this method to ensure a single result.

##### `count(): Promise<number>`

Counts the number of matching records.

```typescript
const userCount = await db.from('users').where((user) => user.isActive).count()
```

> **Note:**
>
> - Uses IndexedDB's optimized `count()` when:
>   - No `where()` clause is applied, OR
>   - `where()` uses an index or primary key
> - Falls back to in-memory counting when `where()` uses a predicate function

##### `exists(): Promise<boolean>`

Checks if any matching records exist.

```typescript
const hasAdmins = await db.from('users').where((user) => user.role === 'admin').exists()
```

> **Note:** This method internally uses [`count()`](#count-promisenumber) for checking existence.

---

#### InsertQuery Methods

##### `values<T>(data: T | T[]): InsertQuery`

Sets the data to insert (single object or array).

```typescript
db.insert('users').values({ name: 'John' })
db.insert('users').values([{ name: 'John' }, { name: 'Jane' }])
```

##### `run(): Promise<T | T[]>`

Executes the insert query and returns the inserted record(s).

```typescript
const user = await db.insert('users').values({ name: 'John' }).run()
```

#### UpdateQuery Methods

##### `set<T>(values: Partial<T>): UpdateQuery`

Sets the values to update.

```typescript
db.update('users').set({ name: 'Jane', age: 30 })
```

##### `where(predicate: (row: T) => boolean): UpdateQuery`

Filters rows to update.

```typescript
db.update('users').set({ isActive: false }).where((user) => user.id === 1)
```

##### `run(): Promise<number>`

Executes the update query and returns the number of updated records.

```typescript
const count = await db.update('users').set({ name: 'Jane' }).run()
```

---

#### DeleteQuery Methods

##### `where(predicate: (row: T) => boolean): DeleteQuery`

Filters rows to delete.

```typescript
db.delete('users').where((user) => user.id === 1)
```

##### `run(): Promise<number>`

Executes the delete query and returns the number of deleted records.

```typescript
const count = await db.delete('users').where((user) => user.id === 1).run()
```

---

### Utility Functions

#### `uuidV4(uppercase?: boolean): UUID<'v4'>`

Generates a random UUID v4 string.

**Parameters:**

- `uppercase`: Whether to return uppercase format (optional, default: `false`)

**Returns:** UUID v4 string

**Example:**

```typescript
import { uuidV4 } from 'locality-idb';

const id = uuidV4(); // "550e8400-e29b-41d4-a716-446655440000"
const upperId = uuidV4(true); // "550E8400-E29B-41D4-A716-446655440000"
```

#### `getTimestamp(value?: string | number | Date): Timestamp`

Gets a timestamp in ISO 8601 format from various input types.

> Can be used to generate current timestamp or convert existing date inputs to use as timestamp.

**Parameters:**

- `value`: Optional date input:
  - `string`: ISO date string or any valid date string
  - `number`: Unix timestamp (milliseconds)
  - `Date`: Date object

**Returns:** ISO 8601 timestamp string

> **Remarks:** If no value is provided or the provided value is invalid, the current date and time will be used.

**Example:**

```typescript
import { getTimestamp } from 'locality-idb';

// Current timestamp
const now = getTimestamp(); // "2026-01-29T12:34:56.789Z"

// From Date object
const fromDate = getTimestamp(new Date('2025-01-01')); // "2025-01-01T00:00:00.000Z"

// From ISO string
const fromString = getTimestamp('2025-06-15T10:30:00.000Z'); // "2025-06-15T10:30:00.000Z"

// From Unix timestamp
const fromUnix = getTimestamp(1704067200000); // "2024-01-01T00:00:00.000Z"

// Invalid input falls back to current time
const fallback = getTimestamp('invalid'); // Current timestamp
```

#### `isTimestamp(value: unknown): value is Timestamp`

Checks if a value is a valid Timestamp string in ISO 8601 format.

**Parameters:**

- `value`: The value to check

**Returns:** `true` if the value is a valid Timestamp, otherwise `false`

**Example:**

```typescript
import { isTimestamp } from 'locality-idb';

isTimestamp('2026-01-29T12:34:56.789Z'); // true
isTimestamp('2026-01-29'); // false (not full ISO 8601)
isTimestamp('invalid'); // false
isTimestamp(123); // false
```

#### `openDBWithStores(name: string, stores: StoreConfig[], version?: number): Promise<IDBDatabase>`

Opens an IndexedDB database with specified stores (low-level API).

> Internally used by `Locality` class. Can be used for custom setups.

**Parameters:**

- `name`: Database name
- `stores`: Array of store configurations
- `version`: Database version (optional, default: 1)

**Returns:** Promise resolving to `IDBDatabase` instance

**Example:**

```typescript
import { openDBWithStores } from 'locality-idb';

const db = await openDBWithStores(
    'my-db',
    [
        {
            name: 'users',
            keyPath: 'id',
            autoIncrement: true,
        },
    ],
    1
);
```

#### `deleteDB(name: string): Promise<void>`

Deletes an IndexedDB database by name.

**Parameters:**

- `name`: The name of the database to delete

**Returns:** A promise that resolves when the database is deleted

**Example:**

```typescript
import { deleteDB } from 'locality-idb';
await deleteDB('my-database');
```

> **Warning:** This will remove all data and cannot be undone.

---

### Validation

Locality IDB includes built-in validation that automatically validates data types for built-in column types during insert and update operations based on your schema definitions.

#### Automatic Validation

When you insert or update records, Locality IDB automatically validates that the values match their expected column types:

```typescript
const schema = defineSchema({
  users: {
    id: column.int().pk().auto(),
    name: column.text(),
    age: column.int(),
    email: column.varchar(255),
  },
});

const db = new Locality({ dbName: 'app', schema });

// ✅ Valid - all types match
await db.insert('users').values({ name: 'Alice', age: 25, email: 'alice@example.com' }).run();

// ❌ Throws TypeError - age must be an integer
await db.insert('users').values({ name: 'Bob', age: 'twenty', email: 'bob@example.com' }).run();

// ❌ Throws TypeError - email exceeds varchar(255) length
await db.insert('users').values({ name: 'Charlie', age: 30, email: 'a'.repeat(300) }).run();
```

#### `validateColumnType<T>(type: T, value: unknown): string | null`

Manually validate if a value matches the specified column data type.

**Parameters:**

- `type`: The column data type (e.g., `'int'`, `'text'`, `'uuid'`, `'varchar(255)'`)
- `value`: The value to validate

**Returns:** `null` if valid, otherwise an error message string

**Example:**

```typescript
import { validateColumnType } from 'locality-idb';

validateColumnType('int', 42);          // null (valid)
validateColumnType('int', 'hello');     // "'\"hello\"' is not an integer"
validateColumnType('text', 'hello');    // null (valid)
validateColumnType('uuid', '550e8400-e29b-41d4-a716-446655440000'); // null (valid)
validateColumnType('varchar(5)', 'hi'); // null (valid)
validateColumnType('varchar(5)', 'hello world'); // error message
validateColumnType('numeric', 42);      // null (valid)
validateColumnType('numeric', '3.14');  // null (valid)
validateColumnType('numeric', 'abc');   // error message
```

#### Validated Column Types

The following column types are validated:

| Type                       | Validation Rule                                                             |
| -------------------------- | --------------------------------------------------------------------------- |
| `int`                      | Must be an integer                                                          |
| `float` / `number`         | Must be a number                                                            |
| `numeric`                  | Must be a number or numeric string                                          |
| `bigint`                   | Must be a BigInt                                                            |
| `text` / `string`          | Must be a string                                                            |
| `char(n)`                  | Must be a string with exactly `n` characters                                |
| `varchar(n)`               | Must be a string with at most `n` characters                                |
| `bool` / `boolean`         | Must be a boolean                                                           |
| `uuid`                     | Must be a valid UUID string                                                 |
| `timestamp`                | Must be a valid ISO 8601 timestamp string                                   |
| `date`                     | Must be a Date object                                                       |
| `array` / `list` / `tuple` | Must be an array                                                            |
| `set`                      | Must be a Set                                                               |
| `map`                      | Must be a Map                                                               |
| `object`                   | Must be an object                                                           |
| `custom`                   | No validation (always passes, custom validation integration coming soon...) |

---

## 🔧 Type System

Locality IDB provides comprehensive TypeScript support:

### Type Inference Utilities

```typescript
import type {
  InferSelectType,
  InferInsertType,
  InferUpdateType,
  $InferRow,
} from 'locality-idb';

// InferSelectType: Full row type with all fields
type User = InferSelectType<typeof schema.users>;

// InferInsertType: Insert type with auto-generated fields optional
type InsertUser = InferInsertType<typeof schema.users>;

// InferUpdateType: Partial type for updates (excluding primary key)
type UpdateUser = InferUpdateType<typeof schema.users>;

// $InferRow: Direct inference from column definitions
type UserRow = $InferRow<typeof schema.users.columns>;
```

### Branded Types

Locality IDB uses branded types for better type safety:

```typescript
import type { UUID, Timestamp } from 'locality-idb';

// UUID types are branded with their version
type UserId = UUID<'v4'>; // Branded UUID v4

// Timestamps are branded ISO 8601 strings
type CreatedAt = Timestamp; // Branded timestamp string
```

### Helper Types

```typescript
import type {
  GenericObject,
  Prettify,
  NestedPrimitiveKey,
  SelectFields,
} from 'locality-idb';

// GenericObject: Record<string, any>
type MyObj = GenericObject;

// Prettify: Flattens complex types for better readability
type Pretty = Prettify<ComplexType>;

// NestedPrimitiveKey: Extracts nested primitive keys with dot notation
type Keys = NestedPrimitiveKey<{ user: { profile: { age: number } } }>;
// "user.profile.age"

// SelectFields: Projects selected fields from a type
type Selected = SelectFields<User, { name: true; email: true }>;
// { name: string; email: string }
```

---

## 📄 License

[MIT](LICENSE) © [Nazmul Hassan](https://github.com/nazmul-nhb)

---

## 🔗 Links

- **GitHub**: [nazmul-nhb/locality-idb](https://github.com/nazmul-nhb/locality-idb)
- **npm**: [locality-idb](https://www.npmjs.com/package/locality-idb)
- **Author**: [Nazmul Hassan](https://nazmul-nhb.dev)

---

<div align="center">

**Made with ❤️ by [Nazmul Hassan](https://nazmul-nhb.dev)**

If you find this package useful, please consider giving it a ⭐ on [GitHub](https://github.com/nazmul-nhb/locality-idb)!

</div>
