# Field Types Reference

Complete reference for all field types and modifiers available in Mondel's schema builder.

## Basic Types

### `s.string()`

String field with optional constraints.

```typescript
// Basic string
name: s.string();

// With constraints
email: s.string().required().email();
username: s.string().required().min(3).max(20);
url: s.string().url();
pattern: s.string().pattern(/^[A-Z]{3}-\d{4}$/);
```

**Modifiers:**
| Modifier | Description |
|----------|-------------|
| `.min(n)` | Minimum length |
| `.max(n)` | Maximum length |
| `.email()` | Email format validation |
| `.url()` | URL format validation |
| `.pattern(regex)` | Custom regex pattern |

### `s.number()`

Numeric field with optional range constraints.

```typescript
age: s.number().min(0).max(150);
price: s.number().min(0);
quantity: s.number().default(1);
```

**Modifiers:**
| Modifier | Description |
|----------|-------------|
| `.min(n)` | Minimum value |
| `.max(n)` | Maximum value |

### `s.boolean()`

Boolean field.

```typescript
isActive: s.boolean().default(true);
verified: s.boolean().required();
```

### `s.date()`

Date field (stored as BSON Date).

```typescript
birthDate: s.date();
expiresAt: s.date().required();
```

### `s.objectId()`

MongoDB ObjectId field. Used for references to other documents.

```typescript
// Reference to another document
authorId: s.objectId().required();
categoryId: s.objectId();
```

::: tip Implicit \_id
You don't need to define `_id` in your schema. MongoDB auto-generates it, and Mondel includes it in your TypeScript types automatically as `_id: ObjectId`.
:::

## Complex Types

### `s.array(itemType)`

Array of typed items.

```typescript
// Array of strings
tags: s.array(s.string());

// Array of numbers
scores: s.array(s.number());

// Array of objects
addresses: s.array(
  s.object({
    street: s.string(),
    city: s.string(),
    zip: s.string(),
  })
);

// Array of ObjectIds (references)
followers: s.array(s.objectId());
```

### `s.object(properties)`

Nested object with defined properties.

```typescript
profile: s.object({
  bio: s.string(),
  avatar: s.string().url(),
  social: s.object({
    twitter: s.string(),
    github: s.string(),
  }),
});

// With required nested fields
address: s.object({
  street: s.string().required(),
  city: s.string().required(),
  country: s.string().default("US"),
});
```

### `s.json()`

Arbitrary JSON data (mixed type). Use sparingly.

```typescript
// Any JSON structure
metadata: s.json();
settings: s.json();
```

::: warning
`s.json()` bypasses type checking. Prefer `s.object()` when structure is known.
:::

### `s.enum(values)`

String enum from array of values.

```typescript
role: s.enum(["ADMIN", "USER", "GUEST"]).default("USER");
status: s.enum(["PENDING", "ACTIVE", "SUSPENDED"]).required();
priority: s.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
```

### `s.literal(value)`

Exact literal value.

```typescript
// GeoJSON type field
type: s.literal("Point");

// Discriminator field
kind: s.literal("user");
version: s.literal(2);
```

## Common Modifiers

These modifiers work on most field types:

### `.required()`

Makes the field mandatory. Required fields cannot be `null` or `undefined`.

```typescript
email: s.string().required();
```

### `.default(value)`

Sets a default value when field is not provided.

```typescript
role: s.enum(["USER", "ADMIN"]).default("USER");
createdAt: s.date().default(() => new Date());
_id: s.objectId().default("auto"); // Special: auto-generates ObjectId
```

### `.unique()`

Creates a unique index on this field.

```typescript
email: s.string().required().unique();
username: s.string().unique();
```

### `.index(options?)`

Creates an index on this field.

```typescript
// Simple index
email: s.string().index();

// Named index
email: s.string().index({ name: "idx_email" });

// Unique index (alternative to .unique())
email: s.string().index({ unique: true });

// Text search index
title: s.string().index({ type: "text" });
content: s.string().index({ type: "text" });

// Geospatial index
location: s.object({
  type: s.literal("Point"),
  coordinates: s.array(s.number()),
}).index({ type: "2dsphere" });

// TTL index (auto-delete after time)
sessionToken: s.string().index({ expireAfterSeconds: 3600 });

// Sparse index (only index non-null values)
optionalField: s.string().index({ sparse: true });
```

**Index Options:**
| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Index name |
| `unique` | boolean | Unique constraint |
| `sparse` | boolean | Only index documents with field |
| `type` | number \| string | Index type (1, -1, "text", "2dsphere") |
| `expireAfterSeconds` | number | TTL index expiration |
| `partialFilterExpression` | object | Partial index filter |

## Type Inference

Mondel automatically infers TypeScript types from your schema. The `_id` field is always included automatically.

```typescript
import type { InferSchemaType } from "mondel";

const userSchema = defineSchema("users", {
  timestamps: true,
  fields: {
    // _id is implicit - no need to define it
    email: s.string().required(),
    name: s.string(),
    role: s.enum(["ADMIN", "USER"]).default("USER"),
    age: s.number(),
    tags: s.array(s.string()),
    profile: s.object({
      bio: s.string(),
      verified: s.boolean(),
    }),
  },
});

type User = InferSchemaType<typeof userSchema>;
// Inferred type:
// {
//   _id: ObjectId;              // Always included automatically
//   email?: string;
//   name?: string;
//   role?: "ADMIN" | "USER";
//   age?: number;
//   tags?: string[];
//   profile?: {
//     bio?: string;
//     verified?: boolean;
//   };
//   createdAt?: Date;           // From timestamps: true
//   updatedAt?: Date;           // From timestamps: true
// }
```

## Complete Example

```typescript
import { defineSchema, s } from "mondel";

export const productSchema = defineSchema("products", {
  collection: "products",
  timestamps: true,
  fields: {
    // _id is implicit - auto-generated by MongoDB

    // Required fields
    sku: s.string().required().unique().index({ name: "idx_sku" }),
    name: s.string().required().index({ type: "text" }),
    price: s.number().required().min(0),

    // Optional fields with defaults
    status: s.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
    stock: s.number().default(0).min(0),

    // Complex types
    categories: s.array(s.string()),
    variants: s.array(
      s.object({
        name: s.string().required(),
        sku: s.string().required(),
        price: s.number(),
        stock: s.number().default(0),
      })
    ),

    // Nested object
    metadata: s.object({
      weight: s.number(),
      dimensions: s.object({
        width: s.number(),
        height: s.number(),
        depth: s.number(),
      }),
    }),

    // References to other collections
    vendorId: s.objectId().required().index(),
    relatedProducts: s.array(s.objectId()),
  },
  indexes: [{ fields: { status: 1, createdAt: -1 } }, { fields: { vendorId: 1, status: 1 } }],
});
```
