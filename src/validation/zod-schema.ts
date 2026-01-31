import { z, type ZodTypeAny } from "zod";
import type { Schema, FieldDefinition } from "../types";

/**
 * Validates if a value is a valid MongoDB ObjectId.
 * Accepts both ObjectId instances and 24-character hex strings.
 */
function isObjectId(value: unknown): boolean {
  if (typeof value === "object" && value !== null) {
    return (
      "toHexString" in value &&
      typeof (value as { toHexString: unknown }).toHexString === "function"
    );
  }
  if (typeof value === "string") {
    return /^[a-fA-F0-9]{24}$/.test(value);
  }
  return false;
}

/**
 * Builds a Zod string schema with optional constraints.
 */
function buildStringSchema(field: FieldDefinition): ZodTypeAny {
  // Handle enum as a special case
  if (field.enum) {
    return z.enum(field.enum as [string, ...string[]]);
  }

  let schema = z.string();
  if (field.minLength !== undefined) schema = schema.min(field.minLength);
  if (field.maxLength !== undefined) schema = schema.max(field.maxLength);
  if (field.pattern) schema = schema.regex(field.pattern);
  if (field.email) schema = schema.email();
  if (field.url) schema = schema.url();
  return schema;
}

/**
 * Builds a Zod number schema with optional min/max constraints.
 */
function buildNumberSchema(field: FieldDefinition): ZodTypeAny {
  let schema = z.number();
  if (field.min !== undefined) schema = schema.min(field.min);
  if (field.max !== undefined) schema = schema.max(field.max);
  return schema;
}

/**
 * Builds a Zod array schema with typed items.
 */
function buildArraySchema(field: FieldDefinition): ZodTypeAny {
  return field.items ? z.array(fieldToZod(field.items)) : z.array(z.unknown());
}

/**
 * Builds a Zod object schema with typed properties.
 */
function buildObjectSchema(field: FieldDefinition): ZodTypeAny {
  if (!field.properties) {
    return z.record(z.unknown());
  }

  const shape: Record<string, ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(field.properties)) {
    shape[key] = fieldToZod(prop);
  }
  return z.object(shape);
}

/** Maps field types to their Zod schema builders */
const typeBuilders: Record<string, (field: FieldDefinition) => ZodTypeAny> = {
  string: buildStringSchema,
  number: buildNumberSchema,
  boolean: () => z.boolean(),
  date: () => z.date(),
  objectId: () => z.union([z.string(), z.custom((val: unknown) => isObjectId(val))]),
  array: buildArraySchema,
  object: buildObjectSchema,
  json: () => z.unknown(),
  literal: (field) => z.literal(field.literal as string | number | boolean),
};

/**
 * Converts a FieldDefinition to a Zod schema.
 * Handles all field types, required/optional, and default values.
 *
 * @param field - The field definition from schema
 * @returns Zod schema for validation
 */
function fieldToZod(field: FieldDefinition): ZodTypeAny {
  const builder = typeBuilders[field.type];
  let schema = builder ? builder(field) : z.unknown();

  // Apply optional/nullable for non-required fields
  if (!field.required) {
    schema = schema.optional().nullable();
  }

  // Apply default value (skip "auto" which is handled at runtime)
  if (field.default !== undefined && field.default !== "auto") {
    schema = schema.default(field.default);
  }

  return schema;
}

/**
 * Creates a complete Zod schema from a Mondel schema definition.
 * Includes all fields and timestamp fields if configured.
 *
 * @param schema - Mondel schema definition
 * @returns Zod object schema for full document validation
 *
 * @example
 * ```typescript
 * const zod = zodSchema(userSchema);
 * const result = zod.safeParse(document);
 * ```
 */
export function zodSchema<TSchema extends Schema>(
  schema: TSchema
): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};

  for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
    shape[fieldName] = fieldToZod(fieldDef);
  }

  if (schema.timestamps) {
    const ts = schema.timestamps;
    if (ts.createdAt) {
      shape[ts.createdAt] = z.date().optional();
    }
    if (ts.updatedAt) {
      shape[ts.updatedAt] = z.date().optional();
    }
  }

  return z.object(shape);
}

/**
 * Creates a Zod schema for insert operations.
 * Excludes _id and timestamp fields (auto-generated).
 * Used internally by `create()` and `createMany()` methods.
 *
 * @param schema - Mondel schema definition
 * @returns Zod schema for create validation
 */
export function zodCreateSchema<TSchema extends Schema>(
  schema: TSchema
): z.ZodObject<Record<string, ZodTypeAny>> {
  const fullSchema = zodSchema(schema);
  const shape = { ...fullSchema.shape };

  // Remove auto-generated fields
  delete shape["_id"];
  if (schema.timestamps) {
    const ts = schema.timestamps;
    if (ts.createdAt) delete shape[ts.createdAt];
    if (ts.updatedAt) delete shape[ts.updatedAt];
  }

  return z.object(shape);
}

/**
 * Creates a Zod schema for update operations.
 * All fields become optional (partial update support).
 * Used internally by `updateOne()`, `updateMany()`, `updateById()` methods.
 *
 * @param schema - Mondel schema definition
 * @returns Zod schema with all fields optional
 */
export function zodUpdateSchema<TSchema extends Schema>(
  schema: TSchema
): z.ZodObject<Record<string, ZodTypeAny>> {
  const createSchema = zodCreateSchema(schema);
  return createSchema.partial();
}

/**
 * Validates data against a Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Result object with success status and data or errors
 *
 * @example
 * ```typescript
 * const result = validate(zodCreateSchema(userSchema), userData);
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validate<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
