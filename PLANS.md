# Ref

Below are the minimal, complete changes to add a typed .ref(...) API (runtime metadata + type-level validation) using a phantom __ref marker and a mapped-type ValidateRefs<S> that will produce a compile-time error object if any ref is invalid.

Files changed:

- src/core.ts — add runtime ref() implementation and runtime metadata symbol; make ref() return a Column typed with a phantom __ref.
- src/types.ts — add ExtractRef, EnsureRefIsValid, ValidateRefs and update defineSchema signature in src/schema.ts (shown below).

1) src/core.ts (only the parts changed/added; integrate into the file you already have)

```typescript
// src/core.ts
import { isNonEmptyString } from 'toolbox-x/guards';
import type { ColumnDefinition, ColumnValue, TypeName, UpdaterFn, ValidatorFn } from './types';

/** Symbol key for column data type */
export const ColumnType = Symbol('ColumnType');
/**Symbol key for primary key marker */
export const IsPrimaryKey = Symbol('IsPrimaryKey');
/** Symbol key for auto increment marker */
export const IsAutoInc = Symbol('IsAutoInc');
/**Symbol key for optional marker */
export const IsOptional = Symbol('IsOptional');
/** Symbol key for nullable (null) marker */
export const IsNullable = Symbol('IsNullable');
/**Symbol key for indexed marker */
export const IsIndexed = Symbol('IsIndexed');
/** Symbol key for unique marker */
export const IsUnique = Symbol('IsUnique');
/**Symbol key for default value */
export const DefaultValue = Symbol('DefaultValue');
/** Symbol key for custom validation function */
export const ValidateFn = Symbol('ValidateFn');
/**Symbol key for on update marker*/
export const OnUpdate = Symbol('OnUpdate');

/** Symbol key to store runtime ref metadata on Column instances */
export const RefMeta = Symbol('RefMeta');

export type RefAction = 'cascade' | 'restrict' | 'setNull' | 'noAction';

export interface RefOptions {
 onDelete?: RefAction;
 onUpdate?: RefAction;
}

/** Runtime shape for ref metadata attached to a Column instance */
export interface RefMetadata {
 refPath: string; // e.g. 'users.id'
 options?: RefOptions;
}

/** @class Represents a column definition. */
export class Column<T = any, TName extends TypeName = TypeName> {
 declare [ColumnType]: TName;
 declare [IsPrimaryKey]?: boolean;
 declare [IsAutoInc]?: boolean;
 declare [IsOptional]?: boolean;
 declare [IsNullable]?: boolean;
 declare [IsIndexed]?: boolean;
 declare [IsUnique]?: boolean;
 declare [DefaultValue]?: T;
 declare [ValidateFn]?: ValidatorFn<any>;
 declare [OnUpdate]?: UpdaterFn<any>;

 // attach runtime ref metadata using symbol; optional
 declare [RefMeta]?: RefMetadata;

 constructor(type: TName) {
  this[ColumnType] = type;
 }

 // ... existing methods (pk, unique, index, default, optional, nullable, validate, onUpdate, etc.)

 /**
 *
 * Attach a foreign-key-like reference to another table.column using a string path.
 *
 * Runtime: stores metadata at RefMeta (used later by schema/build/runtime code).
 * Type-level: returns the column typed with a phantom `__ref?: R` property so
 * ValidateRefs<S> type can pick up and validate the path at compile time.
 *
 * Usage:
 * column.int().ref('users.id', { onDelete: 'cascade' })
 *
 */
 ref<R extends string>(refPath: R, options?: RefOptions) {
  // Runtime: store metadata on this instance (for later runtime enforcement)
  [this as unknown as Record<PropertyKey, unknown>](RefMeta) = {
   refPath: String(refPath),
   options,
  };

  // Type: return the same column instance type but stamped with a phantom __ref?: R
  // so types.ts can detect and validate it.
  return this as this & {__ref?: R };
 }
}

// PKColumn and Table unchanged (copy existing code)
// ... rest of core.ts (PKColumn, Table)
```

1) src/types.ts — additions for ExtractRef, EnsureRefIsValid, ValidateRefs

Insert these definitions somewhere near other helper/type utilities (I placed them after ExtractColumnType / ResolveColumnType helpers):

```typescript
// src/types.ts
// --- add after existing helper types (e.g., after ResolveColumnType) ---

/**
* Extract a compile-time ref string from a Column instance if present.
* The core.ref method returns a Column stamped with a phantom __ref?: R property,
* so we can extract that literal string here.
*/
export type ExtractRef<C> = C extends { __ref?: infer R } ? (R extends string ? R : never) : never;

/**
* Ensure a single ref string R is valid for schema S.
* Returns true when valid, otherwise returns a descriptive tuple that will appear in the type error.
*
* Valid forms:
* - R must extend ${Table}.${Column}
* - Table must be a key of S
* - Column must be a key of S[Table]
*
* Examples of invalid returns:
* ['Invalid format', R]
* ['Invalid table', R]
* ['Invalid column', R, Table]
*/
export type EnsureRefIsValid<S extends ColumnRecord, R> =
 R extends never
  ? true
  : R extends ${infer T}.${infer K}
   ? T extends keyof S
    ? K extends keyof S[T]
     ? true
     : ['Invalid column', R, T]
    : ['Invalid table', R]
   : ['Invalid format', R];

/**
*
* Build a parallel shaped validation result object for the schema S.
* Each cell is true if the column has no ref or has a valid ref, otherwise the descriptive error tuple.
*/
export type RefValidationMap<S extends ColumnRecord> = {
 [Table in keyof S]: {
  [Col in keyof S[Table]]: EnsureRefIsValid<S, ExtractRef<S[Table][Col]>>;
 };
};


/**
*
* Validate all references in the schema S.
* - If all validations are true, returns S (accepts the schema).
* - If any validation yields an error tuple, returns a descriptive error object (so TypeScript shows helpful context).
*
* Usage: defineSchema(schema: ValidateRefs<S>) so the compiler will enforce validation.
**/
export type ValidateRefs<S extends ColumnRecord> = RefValidationMap<S> extends {
 [Table in keyof S]: { [Col in keyof S[Table]]: true };
}
 ? S
 : {
   'Error: invalid reference(s) found in schema': RefValidationMap<S>;
   };
```

// --- keep the rest of the file unchanged ---

1) src/schema.ts — change defineSchema signature to use ValidateRefs<S>

Replace the existing defineSchema signature (line ~48 in original) with:

```typescript
// src/schema.ts

import { Column, Table } from './core';
import type { /*...*/ ValidateRefs } from './types'; // ensure ValidateRefs is imported

export function defineSchema<S extends import('./types').ColumnRecord>(schema: ValidateRefs<S>): import('./types').Schema<S> {
 const result: Record<string, unknown> = {};

 for (const [tableName, columns] of Object.entries(schema as any)) {
  result[tableName] = new Table(tableName, columns as any);
 }

 return result as import('./types').Schema<S>;
}
```

Notes and usage

- Example valid schema:

```ts
const schema = defineSchema({
 users: {
  id: column.int().pk().auto(),
  name: column.varchar(255),
 },
 posts: {
  id: column.int().pk().auto(),
  userId: column.int().ref('users.id', { onDelete: 'cascade' }),
  title: column.varchar(255),
 },
});
```

- Example invalid schema (will produce a compile-time error and show the validation map):

```ts
const bad = defineSchema({
 users: {
  id: column.int().pk().auto(),
 },
 posts: {
  id: column.int().pk().auto(),
  userId: column.int().ref('nonexistent.id'), // -> Compile-time error: Invalid table 'nonexistent'
 },
});
```

How the validation triggers

- The Column.ref method returns the same Column instance typed with a phantom __ref property.
- ValidateRefs<S> produces a RefValidationMap<S> with a boolean or a descriptive error tuple for each column.
- defineSchema accepts schema: ValidateRefs<S>, so if any cell is not true, the generic collapses to the descriptive error object and TypeScript emits a type error showing the map (pointing to the invalid ref).

Caveats and suggestions

- TypeScript literal inference: to ensure the ref string is preserved as a literal, prefer using schema object literals (TS usually keeps string literal types). If you build the schema programmatically, you might need as const or explicit literal types for the ref path.
- This approach produces a descriptive object in errors. The error object can be a bit verbose, but it pinpoints exactly which refs are invalid.
- This only provides compile-time checking. For runtime enforcement (cascade deletes, setNull, restrict), you must implement behavior in runtime code (during deletes/updates/insert checks) using the runtime metadata stored under RefMeta on column instances.
- If you want nicer errors (e.g., single-line error), the mapped type can be adjusted to return a succinct string literal instead of the object; however this object approach helps debugging by showing the entire validation map.

If you want, I can:

- produce a small patch/PR with these exact file diffs applied to your repo,
- or expand ValidateRefs to collapse the validation result to a single string literal error (less context but simpler error message),
- or also add the runtime enforcement (cascade, setNull, restrict) in the delete/update code paths that use the Column[RefMeta] metadata. Which do you prefer?
