# Queries

The Mondel query builder is designed to mirror the native MongoDB API, but with significantly enhanced type safety.

## CRUD Operations

The client returned from `createClient` (or factory connect) provides fully typed access to your collections.

```typescript
const db = await connect(process.env.MONGO_URI);
```

### Create

```typescript
// type-safe: TypeScript validates field types
await db.users.create({
  email: "john@example.com",
  role: "USER",
});

// bulk creation
await db.users.createMany([{ email: "a@test.com" }, { email: "b@test.com" }]);
```

### Read

Mondel supports MongoDB queries directly, leveraging its types for autocomplete.

```typescript
// Find many matching criteria
const users = await db.users.findMany({
  role: "ADMIN",
});

// Find one document
const user = await db.users.findOne({
  email: "john@example.com",
});

// Find by ID directly (helper)
const user = await db.users.findById("65a0c...id_string");
```

### Update

Updates are also typed, preventing invalid `$set` operations.

```typescript
// Update one
await db.users.updateOne({ email: "john@example.com" }, { $set: { role: "ADMIN" } });

// Update many / native options (e.g., upsert)
await db.users.updateMany({ role: "GUEST" }, { $set: { active: false } }, { upsert: false });

// Update by ID directly
await db.users.updateById("65a0c...id_string", { $set: { name: "Updated Name" } });
```

::: tip Automatic Timestamps
Mondel automatically manages `createdAt` and `updatedAt` timestamps for you, even when using MongoDB operators like `$set` or `$inc`.

- **On Update**: `updatedAt` is automatically set to the current date.
- **On Upsert**: If a new document is created, `createdAt` is also set.

```typescript
// updatedAt is automatically added to the $set operation
await db.users.updateOne({ _id: userId }, { $inc: { loginCount: 1 } });

// upsert: true
// If creates: sets createdAt AND updatedAt
// If updates: sets updatedAt
await db.users.updateOne(
  { email: "new@user.com" },
  { $set: { name: "New User" } },
  { upsert: true }
);
```

:::

### Delete

```typescript
await db.users.deleteOne({ email: "bad@user.com" });
await db.users.deleteOne({ email: "bad@user.com" });
await db.users.deleteMany({}); // clear collection
await db.users.deleteById(userId); // convenience helper
```

````

## Utilities

Mondel provides helpers for common operations like counting and existence checks.

```typescript
// Count matching documents
const count = await db.users.count({ role: "ADMIN" });

// Check existence (optimized with limit: 1)
const exists = await db.users.exists({ email: "john@example.com" });
if (exists) {
  // ...
}
````

## Aggregation

For complex data processing, you can drop down to the aggregation framework.

```typescript
const stats = await db.users.aggregate([
  { $match: { isActive: true } },
  { $group: { _id: "$role", count: { $sum: 1 } } },
]);
```

## Selection & Projection

One of the most powerful features of Mondel is type-safe projection. By default, Mondel returns the full document type. However, if you only select specific fields, the return type is narrowed automatically.

```typescript
const result = await db.users.findOne(
  { email: "john@example.com" },
  { select: { email: true, role: true } } // explicit projection
);

// TypeScript knows result only has email & role
console.log(result.email); // ok
console.log(result.name); // Error: property 'name' does not exist on type '{ email: string; role: ... }'
```

This prevents common bugs where you over-fetch data or try to access fields you excluded from the query.

## Native Options

Because Mondel is a thin wrapper, you have full access to MongoDB native features like sessions and collation.

```typescript
const session = client.startSession();

try {
  await session.withTransaction(async () => {
    await db.users.create(
      { email: "new@user.com" },
      { session } // pass session to options
    );
  });
} finally {
  await session.endSession();
}
```
