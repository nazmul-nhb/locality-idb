# Locality IDB

> **SQL**-like query builder for [**IndexedDB**](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) with [**Drizzle**](https://github.com/drizzle-team/drizzle-orm)-style API

<!-- markdownlint-disable-file MD024 -->

<div align="center">

![npm version](https://img.shields.io/npm/v/locality-idb?color=blue)
![npm downloads](https://img.shields.io/npm/dm/locality-idb)
![license](https://img.shields.io/npm/l/locality-idb)
![beta](https://img.shields.io/badge/status-beta-orange)
<!-- ![bundle](https://img.shields.io/bundlephobia/minzip/locality-idb) -->
<!-- ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue) -->

[API Reference](#-api-reference) • [Examples](#-usage) • [Contributing](#-contributing)

</div>

---

## ⚠️ Beta Status

>This development of the package is currently in **beta stage**. The API is subject to change. Use in production at your own risk.

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
- [Contributing](#-contributing)
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
const users = await db.from('users').all();
const alice = await db
  .from('users')
  .where((user) => user.email === 'alice@example.com')
  .first();

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
const allUsers = await db.from('users').all();
```

#### Filter with Where

```typescript
const admins = await db
  .from('users')
  .where((user) => user.role === 'admin')
  .all();

const activeUsers = await db
  .from('users')
  .where((user) => user.isActive && user.age >= 18)
  .all();
```

#### Select Specific Columns

```typescript
// Include only specified columns
const userNames = await db
  .from('users')
  .select({ name: true, email: true })
  .all();
// Returns: Array<{ name: string; email: string }>

// Exclude specified columns
const usersWithoutPassword = await db
  .from('users')
  .select({ password: false })
  .all();
// Returns: Array<Omit<User, 'password'>>
```

#### Order By

```typescript
const sortedUsers = await db
  .from('users')
  .orderBy('name', 'asc') // or 'desc'
  .all();

// Supports nested keys
const sorted = await db
  .from('users')
  .orderBy('profile.age', 'desc')
  .all();
```

#### Limit Results

```typescript
const topTenUsers = await db
  .from('users')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .all();
```

#### Get First Match

```typescript
const user = await db
  .from('users')
  .where((user) => user.email === 'john@example.com')
  .first();
// Returns: User | null
```

#### Chain Multiple Methods

```typescript
const result = await db
  .from('users')
  .select({ id: true, name: true, email: true })
  .where((user) => user.age >= 18)
  .orderBy('name', 'asc')
  .limit(5)
  .all();
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

##### `orderBy<Key>(key: Key, direction?: 'asc' | 'desc'): SelectQuery`

Orders results by a specified key. Supports nested keys using dot notation.

```typescript
db.from('users').orderBy('name', 'asc')
db.from('users').orderBy('profile.age', 'desc')
```

##### `limit(count: number): SelectQuery`

Limits the number of results.

```typescript
db.from('users').limit(10)
```

##### `all(): Promise<T[]>`

Fetches all matching records.

```typescript
const users = await db.from('users').all()
```

##### `first(): Promise<T | null>`

Fetches the first matching record.

```typescript
const user = await db.from('users').first()
```

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

## 🤝 Contributing

Contributions are welcome! Since this package is in beta, your feedback and contributions are especially valuable.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/nazmul-nhb/locality-idb.git
cd locality-idb

# Install dependencies
pnpm install

# Run development build
pnpm run dev:pkg

# Run demo
pnpm run dev

# Build package
pnpm run build

# Type check
pnpm run typecheck
```

### Reporting Issues

Please report issues on the [GitHub issue tracker](https://github.com/nazmul-nhb/locality-idb/issues).

---

## 📄 License

MIT © [Nazmul Hassan](https://github.com/nazmul-nhb)

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
