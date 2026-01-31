import type { Schema, FieldDefinition, TimestampConfig, CompoundIndexDefinition } from "../types";
import { resolveFields, type SchemaFieldsInput } from "./schema-builder";

interface SchemaInput<
  TFields extends SchemaFieldsInput,
  TTimestamps extends boolean | TimestampConfig = boolean | TimestampConfig,
> {
  collection?: string;
  timestamps?: TTimestamps;
  validation?: {
    enabled?: boolean;
    mode?: "strict" | "loose" | "off";
  };
  connection?: string;
  fields: TFields;
  indexes?: CompoundIndexDefinition[];
}

type InferSchemaFields<TFields extends SchemaFieldsInput> = {
  [K in keyof TFields]: TFields[K] extends { build(): infer FD }
    ? FD extends FieldDefinition<infer T>
      ? FieldDefinition<T> & {
          required: TFields[K] extends { _required: true } ? true : false;
          unique: TFields[K] extends { _unique: true } ? true : false;
        }
      : FieldDefinition
    : FieldDefinition;
};

// Resolved timestamp config type
type ResolvedTimestamps<T> = T extends true
  ? { createdAt: "createdAt"; updatedAt: "updatedAt" }
  : T extends TimestampConfig
    ? T
    : false;

export type InferredSchema<
  TName extends string,
  TFields extends SchemaFieldsInput,
  TTimestamps extends boolean | TimestampConfig = true,
> = Omit<Schema<TName, InferSchemaFields<TFields>>, "timestamps"> & {
  readonly timestamps: ResolvedTimestamps<TTimestamps>;
  readonly __fields: TFields;
};

export function schema<
  const TName extends string,
  const TFields extends SchemaFieldsInput,
  const TTimestamps extends boolean | TimestampConfig = false,
>(
  name: TName,
  definition: SchemaInput<TFields, TTimestamps>
): InferredSchema<TName, TFields, TTimestamps> {
  const resolvedFields = resolveFields(definition.fields);

  const timestamps: TimestampConfig | false =
    definition.timestamps === true
      ? { createdAt: "createdAt", updatedAt: "updatedAt" }
      : definition.timestamps === false || definition.timestamps === undefined
        ? false
        : definition.timestamps;

  return {
    name,
    collection: definition.collection ?? name,
    timestamps,
    validation: definition.validation ?? { enabled: false, mode: "off" },
    connection: definition.connection,
    fields: resolvedFields,
    indexes: definition.indexes ?? [],
  } as unknown as InferredSchema<TName, TFields, TTimestamps>;
}

// Alias for backwards compatibility
export const defineSchema = schema;

export function getFieldIndexes(schema: Schema): Array<{
  field: string;
  options: NonNullable<FieldDefinition["index"]>;
}> {
  const indexes: Array<{ field: string; options: NonNullable<FieldDefinition["index"]> }> = [];

  for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
    if (fieldDef.index) {
      indexes.push({ field: fieldName, options: fieldDef.index });
    }
    if (fieldDef.unique && !fieldDef.index) {
      indexes.push({ field: fieldName, options: { unique: true } });
    }
  }

  return indexes;
}
