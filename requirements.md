# Technical Requirements: Lightweight TypeScript ORM for MongoDB

## 1. Project Overview

**Objective:** Create a lightweight intermediary between the MongoDB native driver and the client, offering:

- Complete type safety without leaving TypeScript
- Simple and intuitive API inspired by Prisma (`manager.collection.method()`)
- Minimal external dependencies (MongoDB driver + Zod for validation)
- Optimized for cold start and bundle size in serverless environments
- No need to import hundreds of types/records
- Multiple database connections support
- Ready for npm publishing as open-source package

**Context:** Solve Prisma/Mongoose incompatibility with Cloudflare Workers while maintaining superior developer experience.

**Package Name:** `mondel` (npm)

---

## 2. Functional Requirements

### 2.1 Schema Definition (Drizzle-inspired, TypeScript-first)

#### RF-2.1.1: Declarative TypeScript Definition

- Schemas defined through TypeScript helper functions
- No proprietary DSL language (like Prisma Schema Language)
- Support primitive types: `string`, `number`, `boolean`, `Date`, `ObjectId`, `Json`
- Fields are optional by default (only use `required()` when needed)
- Support default values
- Support basic validations (required, unique, indexed)
- Support enum types with type-safe validation
- Support collection name mapping (custom MongoDB collection names)
- Support automatic timestamp fields (createdAt, updatedAt)

**Expected Example:**

```typescript
import { defineSchema, s } from "mondel";

export const userSchema = defineSchema("users", {
  // Collection name mapping (optional if same as schema name)
  collection: "users",

  // Automatic timestamp fields
  timestamps: true, // adds createdAt and updatedAt automatically

  fields: {
    _id: s.objectId().default("auto"),
    email: s.string().unique().required().index({ name: "idx_email" }),
    name: s.string(),
    age: s.number().min(0).max(150),
    role: s.enum(["ADMIN", "MODERATOR", "USER"]).default("USER"),
    status: s.enum(["ACTIVE", "INACTIVE", "BANNED"]).default("ACTIVE"),
    tags: s.json(),
    metadata: s.object({
      lastLogin: s.date(),
      loginCount: s.number().default(0),
    }),
  },

  // Compound indexes only (simple indexes use .index() on fields)
  indexes: [
    {
      fields: { role: 1, status: 1 },
      options: { name: "idx_user_role_status" },
    },
    {
      fields: { name: "text", email: "text" },
      options: { name: "idx_user_search" },
    },
  ],
});
```

#### RF-2.1.2: Enum Support

- Inline enum arrays for schema validation (MongoDB stores as strings)
- Type-safe validation at runtime via Zod
- TypeScript type inference from enum arrays
- No separate enum definitions needed (unlike PostgreSQL)

**Expected Example:**

```typescript
import { defineSchema, s } from "mondel";

const orderSchema = defineSchema("orders", {
  fields: {
    status: s
      .enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"])
      .default("PENDING"),
    priority: s.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  },
});

// TypeScript infers: status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED"
```

#### RF-2.1.3: Index Definitions

Indexes are defined directly on fields via `.index()`. Use `indexes[]` only for compound indexes.

**Field-level `.index()` options:**

- `type` - Index type: `1` (asc), `-1` (desc), `"text"`, `"2dsphere"`, `"2d"`
- `name` - Custom index name
- `unique` - Unique constraint
- `sparse` - Sparse index
- `expireAfterSeconds` - TTL index
- `partialFilterExpression` - Partial index filter

**Expected Example - Field Level Indexes:**

```typescript
const storeSchema = defineSchema("stores", {
  fields: {
    // Simple index (ascending by default)
    sku: s.string().required().index({ unique: true, name: "idx_sku" }),

    // Named index
    name: s.string().required().index({ name: "idx_name" }),

    // Text index for search
    description: s.string().index({ type: "text", name: "idx_description" }),

    // TTL index for auto-expiration
    expiresAt: s.date().index({ expireAfterSeconds: 0, name: "idx_ttl" }),

    // Sparse index
    promoCode: s.string().index({ sparse: true, name: "idx_promo" }),

    // Geospatial 2dsphere index
    location: s
      .object({
        type: s.literal("Point"),
        coordinates: s.array(s.number()),
      })
      .index({ type: "2dsphere", name: "idx_location" }),

    category: s.string().required(),
    price: s.number().required(),
    stock: s.number().default(0),
  },

  // Compound indexes only (multiple fields)
  indexes: [
    {
      fields: { category: 1, price: -1 },
      options: { name: "idx_category_price" },
    },
    {
      fields: { name: "text", description: "text" },
      options: { name: "idx_search", weights: { name: 10, description: 5 } },
    },
    {
      fields: { category: 1 },
      options: {
        name: "idx_instock",
        partialFilterExpression: { stock: { $gt: 0 } },
      },
    },
  ],
});
```

**Geospatial Query Example:**

```typescript
// Find stores near a location
const nearbyStores = await manager.store.findMany({
  where: {
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [-73.9857, 40.7484] },
        $maxDistance: 5000, // meters
      },
    },
  },
});
```

#### RF-2.1.4: Collection Name Mapping

- Map schema name to different MongoDB collection name
- Support singular schema names with plural collection names
- Use `collection` key for explicit mapping

**Expected Example:**

```typescript
// Schema name: 'person' -> Collection name: 'people'
const personSchema = defineSchema("person", {
  collection: "people", // Stored in 'people' collection
  fields: {
    _id: s.objectId().default("auto"),
    fullName: s.string().required(),
  },
});

// Access via schema name
await manager.person.findMany({}); // Queries 'people' collection
```

#### RF-2.1.5: Timestamp Fields

- Automatic `createdAt` field on document creation
- Automatic `updatedAt` field on document updates
- Configurable field names
- Optional disable per-operation

**Expected Example:**

```typescript
const auditSchema = defineSchema("audits", {
  timestamps: {
    createdAt: "created_at", // Custom field name
    updatedAt: "updated_at", // Custom field name
  },
  fields: {
    action: s.string().required(),
    userId: s.objectId().required(),
  },
});

// Or use defaults
const logSchema = defineSchema("logs", {
  timestamps: true, // Uses 'createdAt' and 'updatedAt'
  fields: {
    message: s.string().required(),
  },
});

// Disable timestamps for specific operation
await manager.logs.create(data, { timestamps: false });
```

#### RF-2.1.6: Field Constraints

- **All fields are optional by default** (no need to call `.optional()`)
- `required()` - Field must be present (non-null, non-undefined)
- `unique()` - Field value must be unique in collection
- `default(value)` - Default value if not provided
- `index()` - Create index on field (see RF-2.1.3 for options)

**Expected Example:**

```typescript
const accountSchema = defineSchema("accounts", {
  fields: {
    _id: s.objectId().default("auto"),
    username: s.string().required().unique().index(),
    email: s.string().required().unique(),
    displayName: s.string(), // Optional by default
    loginCount: s.number().default(0),
    isVerified: s.boolean().default(false),
    deletedAt: s.date(), // Optional, for soft deletes
  },
});
```

#### RF-2.1.7: Automatic Type Mapping

- Generate TypeScript types automatically from schema
- Produce types for: `CreateInput`, `UpdateInput`, `WhereInput`, `SelectInput`
- Types available for IDE autocomplete

**Expected Example:**

```typescript
type User = typeof userSchema.$type;
type UserCreateInput = typeof userSchema.$create;
type UserUpdateInput = typeof userSchema.$update;
type UserWhereInput = typeof userSchema.$where;
```

#### RF-2.1.8: Schema Centralization

- Single file or modular schema structure
- Easy import and reuse
- Support multiple collections

### 2.2 CRUD Operations with Prisma-inspired API

#### RF-2.2.1: Collection Access

- Interface `manager.schemaName.method()`
- No need to import types manually
- Auto-discovery of available methods

**Expected Example:**

```typescript
const user = await manager.user.findOne({ email: "test@example.com" });
const users = await manager.user.findMany({ role: "ADMIN" });
const created = await manager.user.create({
  email: "new@example.com",
  name: "John",
});
const updated = await manager.user.updateOne({ _id: userId }, { name: "Jane" });
const deleted = await manager.user.deleteOne({ _id: userId });
```

#### RF-2.2.2: Basic CRUD Methods

- `findOne(where)` - Find a single document
- `findMany(where, options?)` - Find multiple documents
- `findById(_id)` - Find by ID (convenience method)
- `findFirst(where)` - Find first matching document
- `create(data)` - Create new document
- `createMany(data[])` - Create multiple documents
- `updateOne(where, data)` - Update one document
- `updateMany(where, data)` - Update multiple documents
- `upsert(where, create, update)` - Update or create
- `deleteOne(where)` - Delete one document
- `deleteMany(where)` - Delete multiple documents
- `count(where?)` - Count documents
- `exists(where)` - Check if document exists

#### RF-2.2.3: Filters and Query Operators

- `equals` - Equality (default)
- `in` - Within array
- `nin` - Not in array
- `gt`, `gte`, `lt`, `lte` - Comparison operators
- `contains` - String contains (case-sensitive)
- `icontains` - String contains (case-insensitive)
- `startsWith`, `endsWith` - String matching
- `regex` - Regular expression matching
- `exists` - Field exists (true/false)
- `isNull` - Field is null

**Expected Example:**

```typescript
manager.user.findMany({
  where: {
    age: { gt: 18, lt: 65 },
    email: { contains: "@example.com" },
    role: { in: ["ADMIN", "MODERATOR"] },
    deletedAt: { exists: false },
  },
});
```

#### RF-2.2.4: Boolean Logic in Filters

- Support `AND` (implicit with multiple fields)
- Support `OR` (array of conditions)
- Support `NOT` (condition negation)

**Expected Example:**

```typescript
manager.user.findMany({
  where: {
    AND: [{ role: "ADMIN" }, { createdAt: { gte: new Date("2024-01-01") } }],
  },
});

manager.user.findMany({
  where: {
    OR: [{ role: "ADMIN" }, { role: "MODERATOR" }],
  },
});
```

#### RF-2.2.5: Pagination and Sorting

- `skip` - Number of documents to skip
- `take` - Number of documents to return
- `orderBy` - Field and direction (asc/desc)
- Support multiple sort fields

**Expected Example:**

```typescript
manager.user.findMany({
  where: { role: "ADMIN" },
  skip: 10,
  take: 5,
  orderBy: [{ createdAt: "desc" }, { name: "asc" }],
});
```

#### RF-2.2.6: Field Selection (Select)

- Specify which fields to return
- Return type adjusted based on select
- `false` = exclude field, `true` = include

**Expected Example:**

```typescript
const user = await manager.user.findOne(
  { _id: userId },
  {
    select: {
      _id: true,
      email: true,
      name: true,
      // age not included
    },
  }
);
// Type: { _id: string; email: string; name?: string }
```

### 2.3 Collection Relationships

#### RF-2.3.1: Relationship Definition in Schema

- Support references between schemas
- Support 1-1, 1-N, M-N via array of IDs
- Type safety for related fields

**Expected Example:**

```typescript
export const postSchema = defineSchema("posts", {
  fields: {
    _id: s.objectId().default("auto"),
    title: s.string().required(),
    authorId: s.objectId().required(),
    author: s.relation("user", "authorId"),
    tagIds: s.array(s.objectId()),
  },
});

export const userSchema = defineSchema("users", {
  fields: {
    _id: s.objectId().default("auto"),
    email: s.string().required(),
    posts: s.relation("post", "_id", "authorId"),
  },
});
```

#### RF-2.3.2: Populate/Include Relationships

- Fetch documents with related data
- Support nested populate
- Type safety for populated data

**Expected Example:**

```typescript
const post = await manager.post.findOne(
  { _id: postId },
  {
    populate: {
      author: true, // Load complete user
      tags: { select: { _id: true, name: true } },
    },
  }
);
// Type includes: author: User, tags: Tag[]
```

#### RF-2.3.3: Create with Nested Relationships

- Ability to create document and relate in one operation

**Expected Example:**

```typescript
const post = await manager.post.create({
  title: "My Post",
  authorId: userId,
  tagIds: [tag1Id, tag2Id],
});
```

### 2.4 Advanced Operations

#### RF-2.4.1: Aggregation Pipeline (Raw)

- Access to native MongoDB aggregations
- No complete typing (too complex)
- Useful for edge cases

**Expected Example:**

```typescript
const results = await manager.user.aggregate([
  { $match: { role: "ADMIN" } },
  { $group: { _id: "$role", count: { $sum: 1 } } },
]);
```

#### RF-2.4.2: Transactions

- Support multi-document transactions
- Requires replica set (document requirement)

**Expected Example:**

```typescript
const result = await manager.transaction(async (tx) => {
  const user = await tx.user.create({ email: "new@example.com" });
  const post = await tx.post.create({ title: "Post", authorId: user._id });
  return { user, post };
});
```

#### RF-2.4.3: Bulk Operations

- `insertMany` - Insert multiple documents
- `updateMany` with bulk updates
- `deleteMany`
- `bulkWrite` - Mixed operations in single call

**Expected Example:**

```typescript
const result = await manager.user.insertMany([
  { email: "user1@example.com", name: "User 1" },
  { email: "user2@example.com", name: "User 2" },
]);
```

### 2.5 Multiple Database Connections

#### RF-2.5.1: Connection Manager

- Support multiple MongoDB connections simultaneously
- Named connections for different databases/clusters
- Database name comes from URI (e.g., `mongodb://host/mydb`)
- Accept MongoDB driver options for fine-grained control
- Connection pooling per connection
- Lazy connection initialization

**Expected Example:**

```typescript
import { createConnectionManager } from "mondel";

const connections = createConnectionManager({
  default: {
    uri: process.env.MONGODB_URI, // mongodb://localhost:27017/main_db
  },
  analytics: {
    uri: process.env.ANALYTICS_MONGODB_URI, // mongodb://analytics-host/analytics_db
    options: {
      maxPoolSize: 50,
      minPoolSize: 10,
      maxIdleTimeMS: 30000,
    },
  },
  legacy: {
    uri: process.env.LEGACY_MONGODB_URI,
    options: {
      readPreference: "secondaryPreferred",
      retryWrites: true,
    },
  },
});

// Access specific connection
const mainManager = connections.get("default");
const analyticsManager = connections.get("analytics");

// Use managers independently
const user = await mainManager.user.findOne({ email: "test@example.com" });
const event = await analyticsManager.event.create({ type: "page_view" });
```

#### RF-2.5.2: Schema Binding to Connections

- Schemas can be bound to specific connections
- Default connection fallback
- Type-safe connection access

**Expected Example:**

```typescript
// Bind schema to specific connection
const analyticsSchema = defineSchema("events", {
  connection: "analytics",
  fields: {
    _id: s.objectId().default("auto"),
    type: s.string().required(),
    data: s.json(),
  },
});

// Or specify at runtime
const manager = createManager({
  schemas: [userSchema, postSchema],
  connection: connections.get("default"),
});
```

#### RF-2.5.3: Connection Lifecycle

- `connect()` - Establish connection
- `disconnect()` - Close connection
- `isConnected()` - Check connection status
- Auto-reconnection on failure
- Graceful shutdown support

**Expected Example:**

```typescript
// Initialize connections
await connections.connectAll();

// Check specific connection
if (connections.get("analytics").isConnected()) {
  // perform operation
}

// Graceful shutdown
await connections.disconnectAll();
```

### 2.6 Schema Validation with Zod 4

#### RF-2.6.1: Zod Integration

- Native Zod 4 (latest) schema generation from ORM schema
- Runtime validation on create/update operations
- Optional validation (can be disabled for performance)
- Custom validation messages

**Expected Example:**

```typescript
import { defineSchema, s, zodSchema } from "mondel";

const userSchema = defineSchema("users", {
  fields: {
    _id: s.objectId().default("auto"),
    email: s.string().required().email(), // Zod email validation
    age: s.number().min(0).max(150),
    username: s.string().required().min(3).max(50),
  },
  validation: {
    enabled: true,
    mode: "strict", // 'strict' | 'loose' | 'off'
  },
});

// Get Zod schema for external use
const userZodSchema = zodSchema(userSchema);

// Manual validation
const result = userZodSchema.safeParse(data);
if (!result.success) {
  console.error(result.error.issues);
}
```

#### RF-2.6.2: Validation Modes

- **strict** - Validate all operations (create, update)
- **loose** - Validate only create operations
- **off** - No validation (maximum performance)

**Expected Example:**

```typescript
// Per-operation validation override
await manager.user.create(data, { validate: true });
await manager.user.updateOne(where, data, { validate: false });
```

#### RF-2.6.3: Custom Validators

- Support custom Zod refinements
- Async validation support
- Cross-field validation

**Expected Example:**

```typescript
const userSchema = defineSchema("users", {
  fields: {
    password: s.string().required().min(8),
    confirmPassword: s.string().required(),
  },
  validators: [
    // Cross-field validation
    z.refine((data) => data.password === data.confirmPassword, {
      message: "Passwords must match",
      path: ["confirmPassword"],
    }),
  ],
});
```

### 2.7 Indexes and Optimizations

#### RF-2.7.1: Index Definition in Schema

- `index()` - Create simple index (with optional config)
- `unique()` - Create unique index
- `text()` - Text index for search
- Complex indexes via `indexes` array (see RF-2.1.3)

**Expected Example:**

```typescript
export const userSchema = defineSchema("users", {
  fields: {
    email: s.string().unique().index(),
    name: s.string().index({ name: "idx_name" }),
    bio: s.string().text(),
  },
});
```

#### RF-2.7.2: Performance Hints

- Best practices documentation
- Warnings about expensive operations (count on large collections)
- Query explain support for debugging

---

## 3. Non-Functional Requirements

### 3.1 Performance

#### RNF-3.1.1: Bundle Size

- Minimum possible, target < 25KB minified (excluding Zod)
- Minimal external dependencies
- Only MongoDB driver and Zod as peer dependencies
- Tree-shakeable exports

#### RNF-3.1.2: Cold Start

- Manager initialization must be < 100ms
- Lazy loading of schemas
- No unnecessary processing on boot
- Connection pooling for serverless

#### RNF-3.1.3: Query Performance

- Execute queries efficiently against MongoDB
- Avoid N+1 queries
- Support indexes properly
- Query batching where applicable

#### RNF-3.1.4: Memory Footprint

- Minimal memory usage at runtime
- No unnecessary caching of results
- Type generation only at compile time

### 3.2 Developer Experience

#### RNF-3.2.1: Autocomplete and IDE Support

- Full TypeScript intellisense
- Method autocomplete by collection
- Field autocomplete in where/select
- Hover documentation
- Go-to-definition support

#### RNF-3.2.2: Error Handling

- Clear error messages
- Useful stack traces
- Input validation with helpful messages
- Zod error formatting integration

#### RNF-3.2.3: Type Safety

- Zero implicit any
- Dynamically adjusted types (select narrowing)
- Impossible states not representable
- Strict mode compatible

### 3.3 Compatibility

#### RNF-3.3.1: Cloudflare Workers

- Work in Workers environment
- Compatible with Workers connection limits
- Optimized for edge computing

#### RNF-3.3.2: Node.js

- Compatible with Node 18+
- Work in local development
- Test with and without bundle

#### RNF-3.3.3: Other Runtimes

- Support Edge Runtime (Vercel)
- Support traditional Node runtime
- Support Deno (if possible)
- Support Bun runtime

### 3.4 Maintainability

#### RNF-3.4.1: Code Organization

- Clear separation of responsibilities
- Easy to extend with new methods
- Easy to maintain and debug
- Modular architecture

#### RNF-3.4.2: Testing

- Unit tests for each functionality
- Integration tests with real MongoDB
- Functional usage examples
- Test coverage > 80%

#### RNF-3.4.3: Documentation

- Complete README
- Examples for each feature
- Troubleshooting guide
- Migration guide (if applicable)
- API reference documentation

---

## 4. Technical Implementation Requirements

### 4.1 Technology Stack

#### TEC-4.1.1: Language and Tools

- **Language:** TypeScript 5.0+
- **Package Manager:** npm (primary), pnpm/yarn compatible
- **Builder:** tsup (esbuild-based) for library bundling
- **Testing:** Vitest
- **MongoDB Driver:** `mongodb` (v6.0+)
- **Validation:** Zod 4 (latest)
- **Linting:** ESLint + Prettier

#### TEC-4.1.2: Versioning

- Semantic Versioning (semver)
- CHANGELOG.md with conventional commits
- GitHub Releases with auto-generated notes
- npm tags (latest, beta, next)

#### TEC-4.1.3: CI/CD

- GitHub Actions for tests
- Automated npm publishing on release
- Type checking in CI
- Bundle size tracking
- Automated security scanning

### 4.2 Project Structure

#### TEC-4.2.1: Architecture

```
mondel/
├── src/
│   ├── schema/           # Schema definition and builders
│   │   ├── types.ts      # Field type definitions
│   │   ├── enum.ts       # Enum support
│   │   ├── index.ts      # Index definitions
│   │   └── define.ts     # defineSchema function
│   ├── manager/          # Manager class and proxies
│   │   ├── manager.ts    # Main manager class
│   │   ├── collection.ts # Collection proxy
│   │   └── connection.ts # Connection manager
│   ├── query/            # Query building
│   │   ├── builder.ts    # Query builder
│   │   ├── filters.ts    # Filter operators
│   │   └── operators.ts  # MongoDB operators
│   ├── validation/       # Zod integration
│   │   ├── zod.ts        # Zod schema generation
│   │   └── validators.ts # Custom validators
│   ├── types/            # TypeScript utilities
│   │   ├── infer.ts      # Type inference
│   │   └── utils.ts      # Type utilities
│   ├── utils/            # Helper functions
│   └── index.ts          # Public exports
├── tests/                # Test files
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── examples/             # Usage examples
├── docs/                 # Documentation
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── README.md
```

#### TEC-4.2.2: Entry Points

- `index.ts` - Main public exports
- Specific exports for tree-shaking
- ESM and CommonJS builds
- TypeScript declarations included

### 4.3 Types and Generics

#### TEC-4.3.1: Type System

- Use Conditional Types for type narrowing
- Use Mapped Types to generate CRUD types
- Use Type Inference for auto-discovery
- Template literal types for query building

#### TEC-4.3.2: Type Generation

- Type inference at compile time
- Optional runtime type checking via Zod
- Type predicates for narrowing
- Branded types for ObjectId

### 4.4 npm Publishing Requirements

#### TEC-4.4.1: Package Configuration

```json
{
  "name": "mondel",
  "version": "1.0.0",
  "description": "Lightweight TypeScript ORM for MongoDB with Zod validation",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "keywords": ["mongodb", "orm", "typescript", "zod", "cloudflare-workers", "serverless", "edge"],
  "peerDependencies": {
    "mongodb": "^6.0.0",
    "zod": "^3.24.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "license": "MIT"
}
```

#### TEC-4.4.2: Documentation Requirements

- README with quick start guide
- Full API documentation
- TypeDoc generated API reference
- Examples for common use cases
- Contributing guide
- Code of conduct

#### TEC-4.4.3: Quality Gates

- All tests passing
- TypeScript strict mode compliant
- ESLint no errors
- Bundle size < 25KB (core)
- 80%+ test coverage

---

## 5. MVP Scope

### Phase 1 Features (MVP) ✅ COMPLETED

- [x] Schema definition (TypeScript-first, simple)
- [x] Enum support with type safety
- [x] Automatic type generation
- [x] Basic CRUD: create, findOne, findMany, updateOne, deleteOne
- [x] Simple filters: equals, in, gt/gte/lt/lte, contains (via MongoDB Filter type)
- [x] Pagination: skip, limit
- [x] Sorting: sort (single + multiple)
- [x] Field selection (type narrowing via select)
- [x] Count and exists
- [x] Client proxy per collection (100% type-safe)
- [x] Basic error handling
- [x] Single connection support
- [x] Zod schema generation
- [x] Serverless mode (factory function for Cloudflare Workers)
- [x] MongoDB native options support (upsert, session, etc.)

### Phase 2 Features

- [ ] Multiple database connections
- [ ] Relationships (populate/include)
- [ ] Nested populate
- [x] Complex indexes (compound, TTL, partial, geospatial)
- [x] Timestamps (createdAt, updatedAt)
- [x] Collection name mapping
- [x] Bulk operations (createMany)
- [x] Transactions (via session option passthrough)
- [x] Upsert operations (via MongoDB native options)

### Phase 3 Features

- [x] Aggregation pipeline support
- [x] Automatic index creation (syncIndexes option)
- [ ] Hooks (beforeCreate, afterUpdate, etc)
- [ ] Soft deletes
- [x] Advanced Zod validation modes (strict/loose/off)
- [ ] Query logging/debugging
- [ ] Migration helpers
- [ ] Plugin system

---

## 6. Constraints and Notes

### 6.1 MongoDB Requirements

- MongoDB 6.0+ required
- Transactions require replica set
- ObjectId as default type for \_id
- No Decimal128 support (use number)
- No Binary support (use Base64 in string/Json)

### 6.2 Development Environment

- Tests run against real MongoDB (Docker recommended)
- Support .env for CONNECTION_STRING
- npm/pnpm/yarn supported
- Node.js 18+ required

### 6.3 Accepted Limitations (MVP)

- No auto-increment (use ObjectId)
- No automatic migrations (use MongoDB Compass manually)
- No geospatial queries (use raw aggregation)
- No change streams (use MongoDB driver directly)
- No GridFS support (use MongoDB driver directly)

---

## 7. Definition of Done

To consider a feature complete:

- [ ] Code written and reviewed
- [ ] TypeScript compiles without errors (strict mode)
- [ ] Tests written and passing (coverage > 80%)
- [ ] TypeScript types correct (no any)
- [ ] Documentation included (JSDoc + README)
- [ ] Functional usage examples
- [ ] Performance tested (bundle size, cold start)
- [ ] Works in Cloudflare Workers
- [ ] Works in Node.js local
- [ ] Works in Vercel Edge Runtime

---

## 8. Suggested Roadmap

### Sprint 1: Foundation (1-2 weeks)

1. Project setup (tsconfig, vitest, tsup, etc)
2. Schema definition system with field types
3. Enum support implementation
4. Type generation and inference
5. Manager and collection proxy

### Sprint 2: Core CRUD (1-2 weeks)

1. CRUD basic operations
2. Filters and operators
3. Pagination and sorting
4. Select narrowing
5. Count and exists

### Sprint 3: Connections & Validation (1-2 weeks)

1. Multiple connections support
2. Connection manager
3. Zod integration
4. Validation modes
5. Error formatting

### Sprint 4: Advanced Features (1-2 weeks)

1. Timestamps support
2. Complex indexes
3. Collection name mapping
4. Relationships basics
5. Populate/include

### Sprint 5: Polish & Release (1 week)

1. Complete error handling
2. Documentation
3. Examples
4. Performance optimization
5. npm publish
6. GitHub release

---

## 9. References and Inspiration

- **Prisma:** API design, type generation, schema definition
- **Drizzle:** TypeScript-first approach, minimal dependencies
- **Mongoose:** Schema definition patterns
- **MongoDB Native Driver:** Raw capabilities and performance
- **Zod:** Validation patterns and API design
- **Serverless Concerns:** Cold start, bundle size, edge computing

---

## 10. Next Steps

1. **Requirements Validation:** Review with stakeholders
2. **Architecture Design:** Detail file structure and flow
3. **Prototyping:** Build quick POC to validate feasibility
4. **Implementation:** Start Sprint 1
5. **Community:** Share on GitHub, accept contributions
6. **npm Publish:** Release v1.0.0

---

## 11. API Quick Reference

### Schema Definition

```typescript
import { defineSchema, s } from "mondel";

// Define schema
const userSchema = defineSchema("users", {
  collection: "users", // optional if same as schema name
  timestamps: true,
  fields: {
    _id: s.objectId().default("auto"),
    email: s.string().required().unique().email().index({ name: "idx_email" }),
    name: s.string(),
    status: s.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    age: s.number().min(0).max(150),
  },
});
```

### Manager Usage

```typescript
import { createManager, createConnectionManager } from "mondel";

// Single connection (database from URI)
const manager = createManager({
  uri: process.env.MONGODB_URI, // mongodb://localhost:27017/mydb
  schemas: [userSchema, postSchema],
});

// Multiple connections with options
const connections = createConnectionManager({
  default: { uri: process.env.MONGODB_URI },
  analytics: {
    uri: process.env.ANALYTICS_URI,
    options: { maxPoolSize: 50 },
  },
});

// CRUD operations
const user = await manager.user.create({ email: "test@example.com" });
const users = await manager.user.findMany({ status: "ACTIVE" });
const updated = await manager.user.updateOne({ _id: id }, { name: "John" });
await manager.user.deleteOne({ _id: id });
```

### Validation

```typescript
import { zodSchema } from "mondel";

// Get Zod schema
const userZod = zodSchema(userSchema);

// Validate manually
const result = userZod.safeParse(data);
if (!result.success) {
  console.error(result.error.format());
}

// Auto-validation on operations
await manager.user.create(data, { validate: true });
```
