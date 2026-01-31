# Core Concepts

## Serverless First

Mondel is built from the ground up to solve the challenges of using MongoDB in serverless environments.

### The Problem: Connection Heavy Lifting

In a traditional Node.js server, you establish a database connection once when the process starts. This connection is reused across thousands of requests.

In serverless functions (like AWS Lambda), your code runs in ephemeral containers that might only handle a single request before shutting down.

- **Cold Starts**: If your ORM takes 500ms to connect to MongoDB, every cold start adds 500ms of latency to your user's request.
- **Connection Exhaustion**: If 1,000 users hit your site at once, you launch 1,000 serverless instances. If each opens a new connection, you can easily max out your database's connection limit (e.g., MongoDB Atlas free tier allows 500 connections).

### The Solution: Lightweight Factory

Mondel's `createClient` doesn't connect immediately. It returns a lightweight factory function.

```typescript
// Fast: Creating the client is instant. No network call.
const connect = createClient({ ... });

async function handler(req) {
  // Connect only when needed
  const db = await connect(process.env.MONGO_URI);

  // Do work...

  // In serverless, we often let the platform handle cleanup,
  // or use context.callbackWaitsForEmptyEventLoop = false (AWS)
}
```

This pattern allows the underlying MongoDB Node.js driver to manage connection pooling efficiently where supported, but prevents the overhead of a heavy ORM layer trying to manage its own complex state.

## Type Safety Philosophy

Mondel's primary goal is to bring compile-time safety to MongoDB development.

### Derived Types

We believe you should define your data model once and derive everything else from it.

- **Schema**: The source of truth.
- **TypeScript Interface**: Automatically inferred. `type User = InferSchemaType<typeof userSchema>`.
- **Runtime Validator**: Automatically generated Zod schemas.

This prevents the common problem of having your TypeScript interfaces drift out of sync with your actual database schema or validation logic. If you change a field in your schema definition, your entire codebase updates automatically.
