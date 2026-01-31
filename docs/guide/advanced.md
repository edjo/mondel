# Advanced Features

This guide covers advanced Mondel features for complex use cases.

## Raw Collection Access

For operations not covered by Mondel's API, access the underlying MongoDB collection:

```typescript
const collection = db.users.getCollection();

// Use any MongoDB driver method
const changeStream = collection.watch();
await collection.bulkWrite([
  { insertOne: { document: { email: "a@test.com" } } },
  { updateOne: { filter: { email: "b@test.com" }, update: { $set: { active: true } } } },
]);
```

## Type Inference

Extract TypeScript types from your schemas:

```typescript
import type { InferSchemaType } from "mondel";

// Get the full document type
type User = InferSchemaType<typeof userSchema>;
// { _id: ObjectId, email: string, role: "ADMIN" | "USER", createdAt: Date, ... }

// Use in function signatures
async function createUser(data: Omit<User, "_id" | "createdAt" | "updatedAt">) {
  return db.users.create(data);
}
```

## Custom Validation

### Using Zod Schemas Directly

Mondel exposes the generated Zod schemas for custom validation:

```typescript
import { zodSchema, zodCreateSchema } from "mondel";

// Get the full Zod schema
const userZod = zodSchema(userSchema);

// Validate external data
const result = userZod.safeParse(externalData);
if (!result.success) {
  console.error(result.error.issues);
}

// Get create-specific schema (excludes _id, timestamps)
const createZod = zodCreateSchema(userSchema);
```

### Custom Field Validation

Extend field validation with Zod refinements:

```typescript
import { z } from "zod";

const userSchema = schema("users", {
  fields: {
    email: s.string().required().email(),
    password: s.string().required().min(8),
    confirmPassword: s.string().required(),
  },
});

// Add cross-field validation
const createUserSchema = zodCreateSchema(userSchema).refine(
  (data) => data.password === data.confirmPassword,
  { message: "Passwords don't match", path: ["confirmPassword"] }
);
```

## Aggregation Pipelines

Mondel supports typed aggregation:

```typescript
// Basic aggregation
const stats = await db.orders.aggregate([
  { $match: { status: "COMPLETED" } },
  { $group: { 
    _id: "$customerId", 
    totalSpent: { $sum: "$amount" },
    orderCount: { $count: {} }
  }},
  { $sort: { totalSpent: -1 } },
  { $limit: 10 }
]);

// With $lookup (join)
const usersWithOrders = await db.users.aggregate([
  { $lookup: {
    from: "orders",
    localField: "_id",
    foreignField: "userId",
    as: "orders"
  }},
  { $match: { "orders.0": { $exists: true } } }
]);

// Typed result
interface UserStats {
  _id: string;
  totalSpent: number;
  orderCount: number;
}
const typedStats = await db.orders.aggregate<UserStats>(pipeline);
```

## Indexes

### Field-Level Indexes

```typescript
const userSchema = schema("users", {
  fields: {
    email: s.string().required().unique(), // Unique index
    name: s.string().index(),              // Regular index
    bio: s.string().index({ type: "text" }), // Text search index
    location: s.object({
      type: s.literal("Point"),
      coordinates: s.array(s.number()),
    }).index({ type: "2dsphere" }),        // Geospatial index
    sessionToken: s.string().index({ 
      expireAfterSeconds: 3600             // TTL index (1 hour)
    }),
  },
});
```

### Compound Indexes

```typescript
const userSchema = schema("users", {
  fields: { /* ... */ },
  indexes: [
    // Compound index for common queries
    {
      fields: { role: 1, createdAt: -1 },
      options: { name: "idx_role_created" }
    },
    // Partial index (only active users)
    {
      fields: { email: 1 },
      options: {
        unique: true,
        partialFilterExpression: { isActive: true }
      }
    },
    // Text index on multiple fields
    {
      fields: { name: "text", bio: "text" },
      options: { 
        weights: { name: 10, bio: 5 },
        name: "idx_search"
      }
    }
  ],
});
```

## Multiple Databases

Connect to multiple databases with separate clients:

```typescript
// Main application database
const mainDb = await createClient({
  uri: process.env.MAIN_DB_URI,
  schemas: [userSchema, orderSchema] as const,
});

// Analytics database (separate cluster)
const analyticsDb = await createClient({
  uri: process.env.ANALYTICS_DB_URI,
  schemas: [eventSchema, metricSchema] as const,
});

// Read-only replica for reports
const reportsDb = await createClient({
  uri: process.env.READONLY_DB_URI,
  schemas: [userSchema, orderSchema] as const,
  syncIndexes: false, // Don't sync indexes on replica
});
```

## Request-Scoped Connections (Serverless Pattern)

For serverless applications, use a request-scoped pattern:

```typescript
// db.ts
import { createClient, type SchemasToClient } from "mondel";

const schemas = [userSchema, orderSchema] as const;
export type DbClient = SchemasToClient<typeof schemas>;

const connectDb = createClient({
  serverless: true,
  schemas,
  validation: "strict",
});

// Middleware pattern for Hono/Express
export function dbMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    const db = await connectDb(c.env.MONGODB_URI);
    c.set("db", db);
    
    try {
      await next();
    } finally {
      await db.close();
    }
  };
}

// Usage in handler
app.get("/users", async (c) => {
  const db = c.get("db") as DbClient;
  const users = await db.users.findMany({});
  return c.json(users);
});
```

## Performance Tips

### 1. Use Projections

Only fetch fields you need:

```typescript
// ✅ Good: Only fetch needed fields
const users = await db.users.findMany(
  { isActive: true },
  { select: { _id: true, email: true, name: true } }
);

// ❌ Bad: Fetch entire documents
const users = await db.users.findMany({ isActive: true });
```

### 2. Use Pagination

Always paginate large result sets:

```typescript
const PAGE_SIZE = 50;

const users = await db.users.findMany(
  { role: "USER" },
  { 
    skip: page * PAGE_SIZE, 
    limit: PAGE_SIZE,
    sort: { createdAt: -1 }
  }
);
```

### 3. Batch Operations

Use `createMany` instead of multiple `create` calls:

```typescript
// ✅ Good: Single batch operation
await db.users.createMany(usersArray);

// ❌ Bad: Multiple round trips
for (const user of usersArray) {
  await db.users.create(user);
}
```

### 4. Use Appropriate Indexes

Ensure your queries use indexes:

```typescript
// Check if query uses index
const collection = db.users.getCollection();
const explanation = await collection
  .find({ email: "test@example.com" })
  .explain("executionStats");

console.log(explanation.executionStats.executionStages.stage);
// Should be "IXSCAN" (index scan), not "COLLSCAN" (collection scan)
```
