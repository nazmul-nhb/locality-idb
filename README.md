# Locality IDB

[![Locality IDB](https://raw.githubusercontent.com/nazmul-nhb/locality-idb/refs/heads/main/locality.png)](https://locality.nazmul-nhb.dev/)

> **SQL**-like query builder for `IndexedDB` with a type-safe, chainable API.

---

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/locality-idb?color=blue)](https://www.npmjs.com/package/locality-idb)
[![NPM Downloads](https://img.shields.io/npm/dm/locality-idb)](https://www.npmjs.com/package/locality-idb)
[![Bundle Size](https://deno.bundlejs.com/badge?q=locality-idb)](https://bundlejs.com/?q=locality-idb)
[![License](https://img.shields.io/npm/l/locality-idb)](LICENSE)

[Official Documentation](https://locality.nazmul-nhb.dev) • [Demo Application](https://locality-idb-demo.vercel.app) • [Contributing](CONTRIBUTING.md)

</div>

---

## 🚀 Quick Start

### 1. Installation

Install the package via your preferred package manager:

```bash
# npm
npm install locality-idb

# pnpm
pnpm add locality-idb

# yarn
yarn add locality-idb

# bun
bun add locality-idb

# deno
deno add npm:locality-idb
```

### 2. Usage

```typescript
import { Locality, defineSchema, column } from 'locality-idb';

// Define your schema
const mySchema = defineSchema({
  users: {
    id: column.int().pk().auto(),
    name: column.text(),
    email: column.text().unique(),
    createdAt: column.timestamp(),
  },
  posts: {
    id: column.int().pk().auto(),
    userId: column.int().ref('users.id', {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }).index(),
    title: column.varchar(255),
    content: column.text(),
    createdAt: column.timestamp(),
  },
});

// Initialize database
const db = new Locality({
  dbName: 'my-app-db',
  schema: mySchema,
  version: 1,
});

// Insert data
const user = await db.insert('users').values({ name: 'Alice', email: 'alice@example.com' }).run();

// Query data
const users = await db.from('users').findAll();
const alice = await db.from('users').where((user) => user.email === 'alice@example.com').findFirst();

// Update data
await db.update('users').set({ name: 'Alice in Wonderland' }).where('id', 1).run();

// Delete data
await db.delete('users').where('id', 1).run();
```

For advanced usages and a complete reference, please visit the documentation website:

👉 **<https://locality.nazmul-nhb.dev>**

---

## ✨ Features

`Locality IDB` comes packed with features designed to make `IndexedDB` **simple**, **type-safe**, and highly **performant**:

- 🎯 **Type-Safe**: Full TypeScript support with automatic type inference.
- 🔍 **SQL-like Queries**: Familiar query syntax inspired by Drizzle ORM.
- 🔒 **Transactions**: Execute multiple operations across tables with automatic rollback on failure.
- 🗄️ **Foreign Key References**: Define relationships between tables with foreign key references.
- 🚀 **Modern API**: Clean and intuitive interface for `IndexedDB` operations.
- 📦 **Zero Dependencies**: Comes with zero runtime dependencies.
- 🔄 **Auto-Generation**: Automatic UUID and timestamp generation during insertions.
- 🎨 **Schema-First**: Define your database schema with a simple, declarative API.
- 🛠️ **Rich Column Types**: Support for various data types including custom types.
- ✅ **Built-in Validation**: Validation for built-in column types during insert and update operations.
- 🔧 **Custom Validators**: Define custom validation logic for columns to enforce complex rules.
- 📤 **Database Export**: Export database data as JSON for backup, migration, or debugging.
- 📥 **Database Import**: Import exported data with `'merge'`, `'replace'`, or `'upsert'` modes.

---

## 🎮 Live Demo

Check out the demo application in the [demo/](demo/) directory for selective examples with basic CRUD, transactions, and database export/import and integrity tests.

You can also try the live web demo here:

👉 **<https://locality-idb-demo.vercel.app>**

---

## 📄 License

[MIT](LICENSE) © [Nazmul Hassan](https://github.com/nazmul-nhb)

---

## 🔗 Links

- **GitHub**: [nazmul-nhb/locality-idb](https://github.com/nazmul-nhb/locality-idb)
- **Official Docs**: <https://locality.nazmul-nhb.dev>
- **Demo Application**: <https://locality-idb-demo.vercel.app>
- **NPM Registry**: [locality-idb](https://www.npmjs.com/package/locality-idb)
- **Author**: [Nazmul Hassan](https://nazmul-nhb.dev)

---

**Made with ❤️ by [Nazmul Hassan](https://nazmul-nhb.dev)**

> If you find this package useful, please consider giving it a ⭐ on [GitHub](https://github.com/nazmul-nhb/locality-idb)!
