// ============================================================
// Core API - Schema Definition & Client
// ============================================================
export { schema, defineSchema, s } from "./schema";
export { createClient } from "./client";

// ============================================================
// Validation Utilities
// ============================================================
export { zodSchema, zodCreateSchema, zodUpdateSchema, validate } from "./validation";

// ============================================================
// Re-exports from MongoDB (ensures consistent BSON version)
// ============================================================
export { ObjectId } from "mongodb";

// ============================================================
// Type Exports
// ============================================================
export type {
  // Schema types
  Schema,
  SchemaDefinition,
  FieldDefinition,
  IndexOptions,
  CompoundIndexDefinition,
  TimestampConfig,
  ValidationConfig,
  // CRUD options
  FindOptions,
  CreateOptions,
  CreateManyOptions,
  UpdateOptions,
  DeleteOptions,
  CountOptions,
  AggregateOpts,
  // Type inference helpers
  InferSchemaType,
  CreateInput,
  UpdateInput,
  WhereInput,
  SelectInput,
  SortInput,
  // MongoDB types
  ClientSession,
} from "./types";

export type {
  ServerlessClientConfig,
  NodeClientConfig,
  ClientConfig,
  SchemasToClient,
} from "./client";

// ============================================================
// Advanced/Internal - CollectionProxy for direct access
// ============================================================
export { CollectionProxy } from "./manager/collection-proxy";
