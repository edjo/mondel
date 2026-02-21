# API Reference

A detailed reference for the Mondel API.

## `createClient`

Creates a client instance or connection factory.

### Signature

```typescript
function createClient<S extends Schema[]>(
  config: ClientConfig<S>
): Promise<Client<S>> | ((uri: string) => Promise<Client<S>>);
```

### Configuration Options

| Option        | Type                           | Description                                                                                              |
| :------------ | :----------------------------- | :------------------------------------------------------------------------------------------------------- |
| `schemas`     | `Schema[]`                     | Array of schemas defined with `defineSchema`.                                                            |
| `serverless`  | `boolean`                      | Set to `true` to optimize for serverless environments (returns a factory).                               |
| `uri`         | `string`                       | MongoDB connection URI. Required if `serverless: false`.                                                 |
| `validation`  | `"strict" \| "loose" \| "off"` | Runtime validation strictness mode. Defaults to `"strict"`.                                              |
| `syncIndexes` | `boolean`                      | Deprecated. Legacy startup sync for indexes. Prefer `npx mondel push` in scripts/CI. |

## CLI: `mondel`

See the full CLI guide with all commands, flags, and config examples:
- [/guide/cli](/guide/cli)

## `defineSchema`

Defines a schema for a collection.

`schema` is available as an alias of `defineSchema`.

### Signature

```typescript
function defineSchema<T>(name: string, definition: SchemaDefinition<T>): Schema;
```

### Definition Object

- `collection`: The name of the MongoDB collection. Defaults to `name`.
- `fields`: Object mapping field names to field definitions created via `s`.
- `indexes`: Array of compound index definitions.
- `timestamps`: Boolean or object configuring `createdAt` / `updatedAt` fields. Defaults to `false`.

## `s` (Schema Builder)

A collection of helper functions to build field definitions.

### Methods

- `s.string()`: Creates a string field.
- `s.number()`: Creates a number field.
- `s.boolean()`: Creates a boolean field.
- `s.date()`: Creates a Date field.
- `s.objectId()`: Creates an ObjectId field.
- `s.array(items)`: Creates an array field with the given item type.
- `s.object(props)`: Creates a nested object field with the given properties.
- `s.json()`: Creates an arbitrary JSON field (mixed type).
- `s.literal(value)`: Creates a literal value field.
- `s.enum(values)`: Creates a string enum field from an array of values.

## Chains (Modifiers)

Most field types support chainable modifiers:

- `.required()`: Makes the field non-nullable.
- `.unique()`: Adds a unique index constraint.
- `.default(value)`: Sets a default value.
- `.index(options)`: Adds a single-field index.
- `.min(value)` / `.max(value)`: Adds length or range validation.

## Collection Methods

The `CollectionProxy` instance (e.g., `db.users`) provides the following methods:

### Find

#### `findOne(filter, options?)`

Finds a single document matching the filter.

- **filter**: MongoDB filter query.
- **options**: `select`, `sort`, `session`.
- **Returns**: `Promise<Document | null>`

#### `findMany(filter?, options?)`

Finds multiple documents.

- **filter**: MongoDB filter query (optional).
- **options**: `select`, `sort`, `skip`, `limit`, `session`.
- **Returns**: `Promise<Document[]>`

#### `findById(id, options?)`

Finds a document by its `_id`.

- **id**: `string` or `ObjectId`.
- **options**: `select`, `session`.
- **Returns**: `Promise<Document | null>`

### Create

#### `create(data, options?)`

Creates a new document.

- **data**: Document object (validated).
- **options**: `timestamps`, `session`.
- **Returns**: `Promise<InsertOneResult>`

#### `createMany(data[], options?)`

Creates multiple documents.

- **data**: Array of document objects.
- **options**: `timestamps`, `ordered`, `session`.
- **Returns**: `Promise<InsertManyResult>`

### Update

#### `updateOne(filter, data, options?)`

Updates a single document.

- **filter**: MongoDB filter query.
- **data**: Update object (plain or operators like `$set`).
- **options**: `upsert`, `timestamps`, `session`.
- **Returns**: `Promise<UpdateResult>`

#### `updateMany(filter, data, options?)`

Updates multiple documents.

- **filter**: MongoDB filter query.
- **data**: Update object.
- **options**: `upsert`, `timestamps`, `session`.
- **Returns**: `Promise<UpdateResult>`

#### `updateById(id, data, options?)`

Updates a document by its `_id`.

- **id**: `string` or `ObjectId`.
- **data**: Update object.
- **options**: `upsert`, `timestamps`, `session`.
- **Returns**: `Promise<UpdateResult>`

### Delete

#### `deleteOne(filter, options?)`

Deletes a single document.

- **filter**: MongoDB filter query.
- **options**: `session`.
- **Returns**: `Promise<DeleteResult>`

#### `deleteMany(filter, options?)`

Deletes multiple documents.

- **filter**: MongoDB filter query.
- **options**: `session`.
- **Returns**: `Promise<DeleteResult>`

#### `deleteById(id, options?)`

Deletes a document by its `_id`.

- **id**: `string` or `ObjectId`.
- **options**: `session`.
- **Returns**: `Promise<DeleteResult>`

### Utilities

#### `count(filter?, options?)`

Counts documents matching the filter.

- **filter**: MongoDB filter query (optional).
- **options**: `limit`, `skip`, `session`.
- **Returns**: `Promise<number>`

#### `exists(filter, options?)`

Checks if at least one document matches the filter. Optimized with `limit: 1`.

- **filter**: MongoDB filter query.
- **options**: `session`.
- **Returns**: `Promise<boolean>`

#### `aggregate(pipeline, options?)`

Runs an aggregation pipeline.

- **pipeline**: Array of aggregation stages.
- **options**: `allowDiskUse`, `session`.
- **Returns**: `Promise<Document[]>`

#### `getCollection()`

Returns the underlying MongoDB `Collection` instance for advanced operations.
