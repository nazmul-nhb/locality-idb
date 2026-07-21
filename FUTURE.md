# Future Considerations

## 1. References ⭐⭐⭐⭐⭐

- [x] Implemented the `ref` method (2nd version of the example) for foreign key references.

> [!NOTE]
> Will be implemented later

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

- validate FK existence
- cascade delete
- set null
- restrict deletion
- no action

---

## 2. Better relation loading

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

## 3. Composite indexes

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

## 4. Schema migrations

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

## 5. Live queries

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

## 6. React bindings

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

## 7. Better projection

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

## 8. Full text search

Optional.

```ts
.search('content', 'react')
```

---

## 9. Hooks

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

## 10. Query cancellation

```ts
const controller = new AbortController()

await db
.from("posts")
.findAll({
    signal: controller.signal
})
```

---

## 14. Async validation

Current validation appears synchronous.

Allow

```ts
.validate(async value => {
    ...
})
```

Useful for foreign key existence, uniqueness, etc.

---
