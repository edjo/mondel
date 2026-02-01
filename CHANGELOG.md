# Changelog

All notable changes to Mondel will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-01

### ✨ New Features

#### Enhanced Type Safety
- Improved TypeScript inference for schema definitions
- Better type narrowing for query results
- Stricter typing for field access and mutations

#### Query Builder Improvements
- Enhanced aggregation pipeline support
- Better handling of complex queries
- Improved projection types

#### Developer Experience
- Better error messages with contextual information
- Improved autocomplete for schema fields
- Enhanced documentation and examples

### 🐛 Bug Fixes

- Fixed type inference issues with nested objects
- Resolved edge cases in query result typing
- Improved handling of optional fields

### 📚 Documentation

- Added comprehensive API reference
- Improved getting started guide
- Added more real-world examples
- Enhanced serverless deployment guides

### 🔧 Internal Improvements

- Optimized bundle size for edge environments
- Improved tree-shaking support
- Better code organization and maintainability

---

## [0.1.0] - 2025-11-15

### Initial Release

- **Type-Safe Schema Definition** - Define MongoDB schemas with full TypeScript support
- **CRUD Operations** - Intuitive API for Create, Read, Update, Delete operations
- **Zod Integration** - Built-in runtime validation with Zod schemas
- **Serverless Optimized** - Minimal bundle size (~27KB) for edge environments
- **MongoDB Native** - Full access to MongoDB driver features
- **Query Builder** - Prisma-inspired query interface
- **Aggregation Support** - Type-safe aggregation pipelines
- **Transaction Support** - MongoDB transactions and sessions
- **Cloudflare Workers** - First-class support for Cloudflare Workers
- **Node.js Compatible** - Works in both serverless and traditional Node.js environments
