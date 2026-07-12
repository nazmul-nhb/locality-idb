# Locality IDB

[![Locality IDB](https://raw.githubusercontent.com/nazmul-nhb/locality-idb/refs/heads/main/locality.png)](https://locality.nazmul-nhb.dev/)

> **SQL**-like query builder for `IndexedDB` with a type-safe, chainable API.

---

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/locality-idb?color=blue)](https://www.npmjs.com/package/locality-idb)
[![NPM Downloads](https://img.shields.io/npm/dm/locality-idb)](https://www.npmjs.com/package/locality-idb)
[![Bundle Size](https://deno.bundlejs.com/badge?q=locality-idb)](https://bundlejs.com/?q=locality-idb)
[![License](https://img.shields.io/npm/l/locality-idb)](LICENSE)

[Read the Full Documentation](https://locality.nazmul-nhb.dev) • [Contributing](CONTRIBUTING.md)

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

---

## 📖 Full Documentation

For advanced usages and a complete reference, please visit the documentation website:

👉 **<https://locality.nazmul-nhb.dev>**

Our docs site covers:

- **Core Concepts**: Declarative schema definitions, advanced column type extensions, complex nested types (objects, arrays, maps, sets), and type inference.
- **Detailed Guides**: Queries, predicate & index-based filtering, sorting, pagination, streaming, and transactions with automatic rollbacks.
- **Import & Export**: How to backup and restore your database using JSON imports/exports.
- **Full API Reference**: Complete signature descriptions for `Locality` class, column modifiers, query builders, validation rules, and TypeScript utility helpers.

---

## 🎮 Live Demo

Check out the demo application in the [demo/](demo/) directory for selective examples with basic CRUD, transactions, and database export/import.

You can also try the live web demo here:

👉 **<https://locality-idb-demo.vercel.app>**

---

## 📄 License

[MIT](LICENSE) © [Nazmul Hassan](https://github.com/nazmul-nhb)

---

## 🔗 Links

- **GitHub**: [nazmul-nhb/locality-idb](https://github.com/nazmul-nhb/locality-idb)
- **Official Docs**: <https://locality.nazmul-nhb.dev>
- **NPM Registry**: [locality-idb](https://www.npmjs.com/package/locality-idb)
- **Author**: [Nazmul Hassan](https://nazmul-nhb.dev)

---

**Made with ❤️ by [Nazmul Hassan](https://nazmul-nhb.dev)**

> If you find this package useful, please consider giving it a ⭐ on [GitHub](https://github.com/nazmul-nhb/locality-idb)!
