# Future Considerations

This page details future feature considerations and architectural plans for `Locality IDB`.

## 1. Better Relation Loading

An API to easily load related resources:

- Pull post author along with the post

  ```typescript
  db.from('posts').with({  user: true })
  ```

> `with()` method should be available only if there are refs and allows only the columns marked with `ref()`

This would internally execute optimized index queries and return combined results:

```typescript
{
  id: 1,
  title: "Locality IDB is awesome",
  user: {
    id: 1,
    name: "Alice"
  }
}
```

## 2. Composite Indexes

Allow defining indexes on multiple fields combined:

```typescript
indexes: [
  ['firstName', 'lastName'],
  ['userId', 'createdAt']
]
```

This will improve performance for queries filtering or sorting across multiple fields.

## 3. Hooks

Lifecycle hooks triggers for inserts, updates, and deletes:

```typescript
.beforeInsert()
.afterInsert()
.beforeDelete()
.afterDelete()
```

## 4. Async Validation

Allow validations to execute asynchronously, useful for checking uniqueness or running remote format checks:

```typescript
column.text().validate(async (value) => {
  const exists = await db.from('users').where('username', value).exists();
  return exists ? 'Username already taken' : null;
})
```

## 5. Better Projections

Allowing computed selection projections:

```typescript
// Computed select functions
.select((row) => ({
  fullName: row.first + " " + row.last
}))

// Or combining fields
.select({
  id: true,
  fullName: row => `${row.first} ${row.last}`
})

// Implementing this version would be complex to maintain type safety
```

## 6. Full-Text Search

Built-in indexing and search across text fields:

```typescript
.search('content', 'react')
```

## 7. Live Queries

Real-time database updates for reactive UI bindings:

```typescript
const unsubscribe = db
  .from('notes')
  .watch(notes => {
    // Triggers whenever 'notes' table changes
  });
```

## 8. React Bindings

A standalone package (`@locality-idb/react`) containing custom hooks to fetch and watch query states:

```typescript
const { data } = useQuery(db.from('notes'));

// Or using live queries
const notes = useLiveQuery(db.from('notes'));
```

## 9. Schema Migrations

Providing explicit migration support for schema changes:

```typescript
migrations: [
  {
    version: 2,
    up(db) {
      // Modify schema manually
    }
  }
]
```

## 10. Query Cancellation

Support for `AbortController` signals to cancel long-running cursor reads:

```typescript
const controller = new AbortController();

await db
  .from("posts")
  .findAll({
    signal: controller.signal
  });
```
