# Mondel v0.2.0 - Enhanced Type Safety & Developer Experience 🚀

We're excited to announce **Mondel v0.2.0**, bringing significant improvements to type safety, developer experience, and documentation!

## 🎯 What is Mondel?

Mondel is a lightweight TypeScript ORM for MongoDB, optimized for serverless environments like Cloudflare Workers and Vercel Edge. It provides 100% type-safe operations with minimal bundle size (~27KB) and zero cold-start overhead.

## ✨ What's New in v0.2.0

### 🔒 Enhanced Type Safety

**Improved TypeScript Inference**
- Better type narrowing for query results
- Stricter typing for field access and mutations
- Enhanced autocomplete for schema fields

**Example:**
```typescript
const schema = defineSchema({
  users: {
    name: z.string(),
    email: z.string().email(),
    age: z.number().optional(),
  }
});

// Full type inference and autocomplete
const user = await db.users.findOne({ email: "user@example.com" });
// user.name ✅ (string)
// user.age ✅ (number | undefined)
// user.invalid ❌ (TypeScript error)
```

### 🛠️ Query Builder Improvements

**Enhanced Aggregation Support**
- Better type safety for aggregation pipelines
- Improved handling of complex queries
- Better projection types

**Example:**
```typescript
const results = await db.users.aggregate([
  { $match: { age: { $gte: 18 } } },
  { $group: { _id: "$country", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
// Fully typed results!
```

### 📚 Comprehensive Documentation

- **API Reference** - Complete documentation of all methods
- **Getting Started Guide** - Step-by-step tutorials
- **Real-World Examples** - Production-ready code samples
- **Serverless Guides** - Deployment guides for Cloudflare Workers, Vercel Edge, AWS Lambda

### 🐛 Bug Fixes

- Fixed type inference issues with nested objects
- Resolved edge cases in query result typing
- Improved handling of optional fields
- Better error messages with contextual information

### ⚡ Performance & Bundle Size

- Optimized for edge environments
- Improved tree-shaking support
- Maintained minimal bundle size (~27KB)

## 📦 Installation

```bash
npm install mondel@0.2.0 mongodb zod
```

## 🚀 Quick Start

### 1. Define Your Schema

```typescript
import { defineSchema } from "mondel";
import { z } from "zod";

const schema = defineSchema({
  users: {
    name: z.string(),
    email: z.string().email(),
    age: z.number().optional(),
    createdAt: z.date().default(() => new Date()),
  },
  posts: {
    title: z.string(),
    content: z.string(),
    authorId: z.string(),
    published: z.boolean().default(false),
  }
});
```

### 2. Connect to MongoDB

```typescript
import { MongoClient } from "mongodb";
import { createDatabase } from "mondel";

const client = new MongoClient(process.env.MONGODB_URL);
await client.connect();

const db = createDatabase(client.db("myapp"), schema);
```

### 3. Perform Type-Safe Operations

```typescript
// Create
const user = await db.users.insertOne({
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});

// Read
const users = await db.users.findMany({
  where: { age: { $gte: 18 } },
  select: { name: 1, email: 1 },
});

// Update
await db.users.updateOne(
  { email: "john@example.com" },
  { $set: { age: 31 } }
);

// Delete
await db.users.deleteOne({ email: "john@example.com" });
```

## 🌐 Serverless Ready

### Cloudflare Workers

```typescript
import { MongoClient } from "mongodb";
import { createDatabase } from "mondel";

export default {
  async fetch(request: Request, env: Env) {
    const client = new MongoClient(env.MONGODB_URL);
    await client.connect();
    
    const db = createDatabase(client.db("myapp"), schema);
    
    const users = await db.users.findMany({});
    
    return new Response(JSON.stringify(users), {
      headers: { "Content-Type": "application/json" }
    });
  }
};
```

### Vercel Edge Functions

```typescript
import { MongoClient } from "mongodb";
import { createDatabase } from "mondel";

export const config = { runtime: "edge" };

export default async function handler(request: Request) {
  const client = new MongoClient(process.env.MONGODB_URL);
  await client.connect();
  
  const db = createDatabase(client.db("myapp"), schema);
  const users = await db.users.findMany({});
  
  return new Response(JSON.stringify(users));
}
```

## 🎨 Key Features

- ✅ **100% Type-Safe** - Schema names, fields, and return types fully typed
- ✅ **Serverless First** - Optimized for Cloudflare Workers & Vercel Edge (~27KB)
- ✅ **Zero Magic** - No decorators, no reflection, just pure TypeScript
- ✅ **MongoDB Native** - Full access to MongoDB driver features
- ✅ **Zod Integration** - Built-in runtime validation
- ✅ **Intuitive API** - Prisma-inspired CRUD, Drizzle-inspired schemas

## 📊 Comparison

| Feature | Mondel | Prisma | Mongoose |
|---------|--------|--------|----------|
| Bundle Size | ~27KB | ~200KB+ | ~150KB+ |
| Cloudflare Workers | ✅ | ❌ | ❌ |
| Type Safety | 100% | 100% | Partial |
| Runtime Validation | ✅ (Zod) | ❌ | ✅ |
| Cold Start | Instant | Slow | Medium |
| MongoDB Native | ✅ | ❌ | ✅ |

## 🔧 Requirements

- **Node.js:** 18.0.0+
- **TypeScript:** 5.0+
- **MongoDB:** 6.0+
- **Zod:** 3.24+

## 📚 Documentation

- **Homepage:** https://mondel-orm.pages.dev
- **GitHub:** https://github.com/edjo/mondel
- **NPM:** https://www.npmjs.com/package/mondel

## 🤝 Contributing

We welcome contributions! Check out our [Contributing Guide](./CONTRIBUTING.md).

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

Inspired by:
- **Prisma** - For the intuitive CRUD API
- **Drizzle** - For the schema definition approach
- **Zod** - For runtime validation

Built with ❤️ for the serverless community.

---

**Get started today:**

```bash
npm install mondel@0.2.0
```

Visit [mondel-orm.pages.dev](https://mondel-orm.pages.dev) for full documentation! 🚀
