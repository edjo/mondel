import { Db, ObjectId, type CreateIndexesOptions, type Document, type IndexSpecification } from "mongodb";
import { getFieldIndexes } from "../schema/define-schema";
import type { FieldDefinition, Schema } from "../types";

export interface SyncSchemaOptions {
  dryRun?: boolean;
  applyValidators?: boolean;
  dropUndefinedIndexes?: boolean;
  logger?: (message: string) => void;
}

export interface PulledSchemaManifest {
  generatedAt: string;
  databaseName: string;
  collections: PulledCollectionManifest[];
}

export interface PulledCollectionManifest {
  name: string;
  fields: Record<string, FieldDefinition>;
  indexes: Array<{
    fields: Record<string, 1 | -1 | "text" | "2dsphere" | "2d">;
    options?: {
      name?: string;
      unique?: boolean;
      sparse?: boolean;
      partialFilterExpression?: Document;
      weights?: Record<string, number>;
      expireAfterSeconds?: number;
    };
  }>;
}

interface NormalizedIndex {
  spec: IndexSpecification;
  options: CreateIndexesOptions;
}

function toSafeIdentifier(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9_$]/g, "_")
    .replace(/^[0-9]/, "_$&");
}

function singularizeToken(token: string): string {
  if (token.endsWith("ies") && token.length > 3) {
    return `${token.slice(0, -3)}y`;
  }

  if (
    (token.endsWith("ses") ||
      token.endsWith("xes") ||
      token.endsWith("zes") ||
      token.endsWith("ches") ||
      token.endsWith("shes")) &&
    token.length > 3
  ) {
    return token.slice(0, -2);
  }

  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 1) {
    return token.slice(0, -1);
  }

  return token;
}

function toCamelCase(input: string): string {
  const rawTokens = input
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

  if (rawTokens.length === 0) return "schema";

  const tokens = rawTokens.map(singularizeToken);
  const [head, ...tail] = tokens;
  const camel = `${head}${tail.map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join("")}`;

  return toSafeIdentifier(camel);
}

export function collectionSchemaVarName(collectionName: string): string {
  return toCamelCase(collectionName);
}

export function toSafeFileName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "collection";
}

function indexNameFromSpec(spec: IndexSpecification): string {
  return Object.entries(spec)
    .map(([key, value]) => `${key}_${String(value)}`)
    .join("_");
}

function normalizeIndexes(schema: Schema): NormalizedIndex[] {
  const normalized: NormalizedIndex[] = [];

  const fieldIndexes = getFieldIndexes(schema);
  for (const { field, options } of fieldIndexes) {
    const spec: IndexSpecification = { [field]: options.type ?? 1 };
    const indexOptions: CreateIndexesOptions = {};

    if (options.name) indexOptions.name = options.name;
    if (options.unique) indexOptions.unique = options.unique;
    if (options.sparse) indexOptions.sparse = options.sparse;
    if (options.expireAfterSeconds !== undefined) {
      indexOptions.expireAfterSeconds = options.expireAfterSeconds;
    }
    if (options.partialFilterExpression) {
      indexOptions.partialFilterExpression = options.partialFilterExpression;
    }

    normalized.push({ spec, options: indexOptions });
  }

  for (const index of schema.indexes) {
    const spec: IndexSpecification = index.fields as IndexSpecification;
    const indexOptions: CreateIndexesOptions = {};

    if (index.options?.name) indexOptions.name = index.options.name;
    if (index.options?.unique) indexOptions.unique = index.options.unique;
    if (index.options?.sparse) indexOptions.sparse = index.options.sparse;
    if (index.options?.partialFilterExpression) {
      indexOptions.partialFilterExpression = index.options.partialFilterExpression;
    }
    if (index.options?.weights) {
      indexOptions.weights = index.options.weights;
    }

    normalized.push({ spec, options: indexOptions });
  }

  return normalized;
}

function mapFieldToBsonSchema(field: FieldDefinition): Document {
  switch (field.type) {
    case "string": {
      const result: Document = { bsonType: "string" };
      if (field.minLength !== undefined) result.minLength = field.minLength;
      if (field.maxLength !== undefined) result.maxLength = field.maxLength;
      if (field.pattern) result.pattern = field.pattern.source;
      if (field.enum) result.enum = [...field.enum];
      return result;
    }
    case "number": {
      const result: Document = { bsonType: ["double", "int", "long", "decimal"] };
      if (field.min !== undefined) result.minimum = field.min;
      if (field.max !== undefined) result.maximum = field.max;
      return result;
    }
    case "boolean":
      return { bsonType: "bool" };
    case "date":
      return { bsonType: "date" };
    case "objectId":
      return { bsonType: "objectId" };
    case "array": {
      const result: Document = { bsonType: "array" };
      if (field.items) {
        result.items = mapFieldToBsonSchema(field.items);
      }
      return result;
    }
    case "object": {
      const properties: Record<string, Document> = {};
      const required: string[] = [];

      for (const [name, value] of Object.entries(field.properties ?? {})) {
        properties[name] = mapFieldToBsonSchema(value);
        if (value.required) required.push(name);
      }

      const result: Document = {
        bsonType: "object",
        properties,
        additionalProperties: true,
      };

      if (required.length > 0) result.required = required;
      return result;
    }
    case "literal": {
      const literal = field.literal;
      const bsonType =
        typeof literal === "string"
          ? "string"
          : typeof literal === "number"
            ? ["double", "int", "long", "decimal"]
            : typeof literal === "boolean"
              ? "bool"
              : "object";

      return { bsonType, enum: literal === undefined ? [] : [literal] };
    }
    case "json":
    default:
      return {};
  }
}

function schemaToMongoJsonSchema(schema: Schema): Document {
  const properties: Record<string, Document> = {};
  const required: string[] = [];

  for (const [fieldName, fieldDefinition] of Object.entries(schema.fields)) {
    properties[fieldName] = mapFieldToBsonSchema(fieldDefinition);

    if (fieldDefinition.required) {
      required.push(fieldName);
    }
  }

  if (schema.timestamps) {
    const createdAt = schema.timestamps.createdAt ?? "createdAt";
    const updatedAt = schema.timestamps.updatedAt ?? "updatedAt";
    properties[createdAt] = { bsonType: "date" };
    properties[updatedAt] = { bsonType: "date" };
  }

  const jsonSchema: Document = {
    bsonType: "object",
    properties,
    additionalProperties: true,
  };

  if (required.length > 0) {
    jsonSchema.required = required;
  }

  return jsonSchema;
}

async function applyCollectionValidator(
  db: Db,
  schema: Schema,
  options: SyncSchemaOptions
): Promise<void> {
  const collectionName = schema.collection;
  const validator = { $jsonSchema: schemaToMongoJsonSchema(schema) };
  const exists = await db.listCollections({ name: collectionName }, { nameOnly: true }).hasNext();

  if (!exists) {
    options.logger?.(`Creating collection ${collectionName} with validator`);
    if (!options.dryRun) {
      await db.createCollection(collectionName, { validator });
    }
    return;
  }

  options.logger?.(`Applying validator on ${collectionName}`);
  if (!options.dryRun) {
    await db.command({ collMod: collectionName, validator });
  }
}

export async function syncSchemaIndexes(
  db: Db,
  schemas: readonly Schema[],
  options: SyncSchemaOptions = {}
): Promise<void> {
  for (const schema of schemas) {
    const collection = db.collection(schema.collection);
    const indexes = normalizeIndexes(schema);

    for (const index of indexes) {
      const indexName = index.options.name ?? indexNameFromSpec(index.spec);
      options.logger?.(`Ensuring index ${schema.collection}.${indexName}`);
      if (!options.dryRun) {
        await collection.createIndex(index.spec, index.options);
      }
    }

    if (options.dropUndefinedIndexes) {
      const existingIndexes = await collection.indexes();
      const keep = new Set(
        indexes.map((index) => index.options.name ?? indexNameFromSpec(index.spec)).concat(["_id_"])
      );

      for (const existing of existingIndexes) {
        if (existing.name && !keep.has(existing.name)) {
          options.logger?.(`Dropping index ${schema.collection}.${existing.name}`);
          if (!options.dryRun) {
            await collection.dropIndex(existing.name);
          }
        }
      }
    }

    if (options.applyValidators) {
      await applyCollectionValidator(db, schema, options);
    }
  }
}

function isObjectIdLike(value: unknown): boolean {
  return value instanceof ObjectId ||
    (typeof value === "object" && value !== null && "_bsontype" in value && (value as { _bsontype?: string })._bsontype === "ObjectId");
}

function inferFieldDefinition(value: unknown): FieldDefinition {
  if (value === null || value === undefined) {
    return { type: "json", required: false, unique: false };
  }

  if (isObjectIdLike(value)) {
    return { type: "objectId", required: false, unique: false };
  }

  if (value instanceof Date) {
    return { type: "date", required: false, unique: false };
  }

  if (Array.isArray(value)) {
    const firstVal = value.find((v) => v !== null && v !== undefined);
    return {
      type: "array",
      required: false,
      unique: false,
      items: firstVal !== undefined ? inferFieldDefinition(firstVal) : { type: "json", required: false, unique: false },
    };
  }

  if (typeof value === "string") {
    return { type: "string", required: false, unique: false };
  }

  if (typeof value === "number") {
    return { type: "number", required: false, unique: false };
  }

  if (typeof value === "boolean") {
    return { type: "boolean", required: false, unique: false };
  }

  if (typeof value === "object") {
    const properties: Record<string, FieldDefinition> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      properties[key] = inferFieldDefinition(nested);
    }

    return { type: "object", required: false, unique: false, properties };
  }

  return { type: "json", required: false, unique: false };
}

export async function pullDatabaseSchema(db: Db): Promise<PulledSchemaManifest> {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const manifestCollections: PulledCollectionManifest[] = [];

  for (const collectionMeta of collections) {
    const collectionName = collectionMeta.name;
    const collection = db.collection(collectionName);
    const sample = await collection.findOne({});
    const fields: Record<string, FieldDefinition> = {};

    if (sample && typeof sample === "object") {
      for (const [key, value] of Object.entries(sample)) {
        if (key === "_id") continue;
        fields[key] = inferFieldDefinition(value);
      }
    }

    const rawIndexes = await collection.indexes();
    const indexes = rawIndexes
      .filter((index) => index.name !== "_id_")
      .map((index) => {
        const fields = index.key as Record<string, 1 | -1 | "text" | "2dsphere" | "2d">;
        const options: PulledCollectionManifest["indexes"][number]["options"] = {};

        if (index.name) options.name = index.name;
        if (index.unique) options.unique = true;
        if (index.sparse) options.sparse = true;
        if (index.partialFilterExpression) {
          options.partialFilterExpression = index.partialFilterExpression;
        }
        if (typeof index.expireAfterSeconds === "number") {
          options.expireAfterSeconds = index.expireAfterSeconds;
        }
        if (index.weights) {
          options.weights = index.weights;
        }

        return Object.keys(options).length > 0 ? { fields, options } : { fields };
      });

    manifestCollections.push({
      name: collectionName,
      fields,
      indexes,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    databaseName: db.databaseName,
    collections: manifestCollections,
  };
}

function renderField(field: FieldDefinition): string {
  switch (field.type) {
    case "string": {
      let code = "s.string()";
      if (field.required) code += ".required()";
      if (field.unique) code += ".unique()";
      if (field.enum?.length) code = `s.enum(${JSON.stringify(field.enum)})`;
      return code;
    }
    case "number":
      return `s.number()${field.required ? ".required()" : ""}`;
    case "boolean":
      return `s.boolean()${field.required ? ".required()" : ""}`;
    case "date":
      return `s.date()${field.required ? ".required()" : ""}`;
    case "objectId":
      return `s.objectId()${field.required ? ".required()" : ""}`;
    case "array":
      return `s.array(${field.items ? renderField(field.items) : "s.json()"})${field.required ? ".required()" : ""}`;
    case "object": {
      const properties = Object.entries(field.properties ?? {})
        .map(([name, value]) => `      ${JSON.stringify(name)}: ${renderField(value)},`)
        .join("\n");
      return `s.object({\n${properties}\n    })${field.required ? ".required()" : ""}`;
    }
    case "literal":
      return `s.literal(${JSON.stringify(field.literal)})${field.required ? ".required()" : ""}`;
    case "json":
    default:
      return `s.json()${field.required ? ".required()" : ""}`;
  }
}

export function collectionToMondelSchemaTs(collection: PulledCollectionManifest): string {
  const schemaVar = collectionSchemaVarName(collection.name);
  const fields = Object.entries(collection.fields)
    .map(([name, field]) => `    ${JSON.stringify(name)}: ${renderField(field)},`)
    .join("\n");

  const indexes =
    collection.indexes.length > 0
      ? `,\n  indexes: ${JSON.stringify(collection.indexes, null, 2)
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n")}`
      : "";

  return [
    `import { defineSchema, s } from "mondel";`,
    "",
    `export const ${schemaVar} = defineSchema(${JSON.stringify(collection.name)}, {`,
    `  collection: ${JSON.stringify(collection.name)},`,
    "  fields: {",
    fields,
    `  }${indexes}`,
    `});`,
    "",
  ].join("\n");
}

export function manifestToMondelSchemaTs(manifest: PulledSchemaManifest): string {
  const schemaBlocks = manifest.collections
    .map((collection) => collectionToMondelSchemaTs(collection).replace('import { defineSchema, s } from "mondel";\n\n', ""))
    .join("\n");

  const schemaVars = manifest.collections
    .map((collection) => collectionSchemaVarName(collection.name))
    .join(", ");

  return [
    `// Generated by mondel pull at ${manifest.generatedAt}`,
    'import { defineSchema, s } from "mondel";',
    "",
    schemaBlocks,
    "",
    `export const schemas = [${schemaVars}] as const;`,
    "",
  ].join("\n");
}
