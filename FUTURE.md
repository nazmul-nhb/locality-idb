# Future Considerations

## 0. Add Nullable Column Modifier ⭐⭐⭐⭐⭐

```ts
description: column.varchar(256).nullable();
```

this would be different from:

```ts
description: column.varchar(256).optional();
```

## 1. References ⭐⭐⭐⭐⭐

This would be #1 priority.

Instead of

```ts
userId: column.int().index()
```

```ts
userId: column
  .int()
  .references(() => schema.users.id, {
    onDelete: 'cascade',
    onUpdate: 'restrict',
  })
```

or

```ts
userId: column
  .ref('users.id', {
    onDelete: 'cascade',
    onUpdate: 'restrict',
  })
```

Then Locality could

* validate FK existence
* cascade delete
* set null
* restrict deletion
* no action

---

## 2. Computed Updates ⭐⭐⭐⭐⭐

Instead of only

```ts
.set({
    views: post.views + 1
})
```

support

```ts
.set((row) => ({
    views: row.views + 1
}))
```

> Both should exist as overloads in the same method.

---

## 3. Aggregations

It already has `count()`.

Next:

```ts
.sum('price')

.avg('price')

.max('age')

.min('age')

.distinct('email')
```

These are frequently needed.

---

## 4. Better relation loading

Imagine

```ts
db.from('posts')
.with({
    user: true // or can select user properties here too
})
```

returns

```ts
{
    id,
    title,
    user: {
        ...
    }
}
```

Internally it can perform two indexed queries.

---

## 5. Composite indexes

Instead of

```ts
column.text().index()
```

allow

```ts
indexes: [
    ['firstName', 'lastName'],
    ['userId', 'createdAt']
]
```

Huge performance improvement.

---

## 6. Query reuse

```ts
const adults =
    db.from('users')
      .where(u => u.age >= 18)

await adults.count()

await adults.findAll()

await adults.exists()
```

---

## 7. Bulk operations

Instead of

```ts
await Promise.all(...)
```

have

```ts
insertMany()

updateMany()

deleteMany()
```

with optimized batching.

---

## 8. Schema migrations

Currently versioning relies on IndexedDB upgrades.

Expose something similar to Drizzle.

```ts
migrations: [
    {
        version: 2,
        up(db) {
            ...
        }
    }
]
```

Developers love explicit migrations.

---

## 9. Live queries

This would be huge.

```ts
const unsubscribe = db
  .from('notes')
  .watch(notes => {
    ...
  })
```

Whenever another query changes `notes`, this fires.

Perfect for React.

---

## 10. React bindings

Separate library.

```ts
@locality-idb/react
```

```ts
const { data } = useQuery(
    db.from('notes')
)
```

or

```ts
const notes = useLiveQuery(
    db.from('notes')
)
```

---

## 11. Better projection

Currently

```ts
.select({
    name: true
})
```

I'd also allow

```ts
.select(row => ({
    fullName: row.first + " " + row.last
}))
```

or

```ts
.select({
    id: true,
    fullName: row =>
        `${row.first} ${row.last}`
})
```

Very ORM-like.

---

## 12. Full text search

Optional.

```ts
.search('content', 'react')
```

---

## 13. Hooks

Instead of only validators

```ts
.beforeInsert()

.afterInsert()

.beforeDelete()

.afterDelete()

.beforeUpdate()

.afterUpdate()
```

or

```ts
.before('...', (value) => void)
.after('...', (value) => void)
```

---

## 14. Query cancellation

```ts
const controller = new AbortController()

await db
.from("posts")
.findAll({
    signal: controller.signal
})
```

---

## 15. Async validation

Current validation appears synchronous.

Allow

```ts
.validate(async value => {
    ...
})
```

Useful for foreign key existence, uniqueness, etc.

---
