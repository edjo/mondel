# Transactions

MongoDB supports multi-document transactions for operations that need atomicity. Mondel provides full access to MongoDB sessions and transactions via `db.startSession()`.

## Basic Transaction

```typescript
import { createClient } from "mondel";

const db = await createClient({
  uri: process.env.MONGODB_URI,
  schemas: [userSchema, orderSchema] as const,
});

// Start a session directly from the Mondel client
const session = db.startSession();

try {
  await session.withTransaction(async () => {
    // All operations use the same session
    const user = await db.users.create({ email: "john@example.com", balance: 100 }, { session });

    await db.orders.create({ userId: user.insertedId, amount: 50, status: "PENDING" }, { session });

    // Update user balance
    await db.users.updateById(user.insertedId, { $inc: { balance: -50 } }, { session });
  });

  console.log("Transaction committed successfully");
} catch (error) {
  console.error("Transaction aborted:", error);
} finally {
  await session.endSession();
}
```

## Session Options

All Mondel CRUD methods accept a `session` option:

```typescript
// Find with session
const user = await db.users.findOne({ email }, { session });

// Create with session
await db.users.create(data, { session });

// Update with session
await db.users.updateOne(filter, update, { session });

// Delete with session
await db.users.deleteOne(filter, { session });

// Aggregate with session
await db.users.aggregate(pipeline, { session });

// Count with session
await db.users.count(filter, { session });
```

## Transaction Best Practices

### 1. Keep Transactions Short

Transactions hold locks on documents. Long-running transactions can cause contention.

```typescript
// ✅ Good: Minimal work inside transaction
await session.withTransaction(async () => {
  await db.accounts.updateOne({ _id: from }, { $inc: { balance: -amount } }, { session });
  await db.accounts.updateOne({ _id: to }, { $inc: { balance: amount } }, { session });
});

// ❌ Bad: Heavy computation inside transaction
await session.withTransaction(async () => {
  const report = await generateHeavyReport(); // Don't do this
  await db.reports.create(report, { session });
});
```

### 2. Handle Transient Errors

MongoDB may return transient errors that can be retried:

```typescript
async function runWithRetry(fn: () => Promise<void>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fn();
      return;
    } catch (error: any) {
      if (error.hasErrorLabel?.("TransientTransactionError") && i < maxRetries - 1) {
        continue; // Retry
      }
      throw error;
    }
  }
}
```

### 3. Use Read Concern and Write Concern

For critical operations, specify appropriate concerns:

```typescript
const session = db.startSession({
  defaultTransactionOptions: {
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  },
});
```

## Serverless Considerations

In serverless environments, transactions require careful handling:

- **Connection Pooling**: Ensure sessions are properly closed before the function terminates
- **Timeout**: Set reasonable transaction timeouts to avoid hanging connections
- **Atlas**: MongoDB Atlas supports transactions on M10+ clusters

```typescript
// Serverless-safe transaction pattern
const connectDb = createClient({
  serverless: true,
  schemas: [userSchema, orderSchema] as const,
});

export async function handlePayment(env: Env) {
  const db = await connectDb(env.MONGODB_URI);
  const session = db.startSession();

  try {
    await session.withTransaction(
      async () => {
        // Transaction operations using db.users, db.orders, etc.
      },
      {
        maxCommitTimeMS: 5000, // 5 second timeout
      }
    );
  } finally {
    await session.endSession();
    await db.close();
  }
}
```

## When to Use Transactions

| Use Case                        | Transaction Needed?               |
| ------------------------------- | --------------------------------- |
| Single document update          | No                                |
| Transfer between accounts       | Yes                               |
| Create order + reduce inventory | Yes                               |
| Batch insert (all-or-nothing)   | Yes                               |
| Read-only queries               | No                                |
| Update with read check          | Maybe (consider atomic operators) |

::: tip Atomic Operators
For many cases, MongoDB's atomic operators (`$inc`, `$push`, etc.) can replace transactions:

```typescript
// No transaction needed - atomic operation
await db.products.updateOne(
  { _id: productId, stock: { $gte: quantity } },
  { $inc: { stock: -quantity } }
);
```

:::
