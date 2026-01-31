import type { FieldDefinition, IndexOptions } from "../types";
import {
  StringFieldBuilder,
  NumberFieldBuilder,
  BooleanFieldBuilder,
  DateFieldBuilder,
  ObjectIdFieldBuilder,
  ArrayFieldBuilder,
  ObjectFieldBuilder,
  JsonFieldBuilder,
  LiteralFieldBuilder,
  EnumFieldBuilder,
  type FieldBuilder,
} from "./field-builder";

type FieldBuilderResult = {
  build(): FieldDefinition;
  required(): FieldBuilderResult;
  unique(): FieldBuilderResult;
  default(value: unknown): FieldBuilderResult;
  index(options?: IndexOptions): FieldBuilderResult;
};

type SchemaFieldsInput = Record<string, FieldBuilderResult>;

// Type to infer the value type from a field builder
export type InferFieldBuilderType<T> = T extends FieldBuilder<infer V> ? V : unknown;

function resolveFields(fields: SchemaFieldsInput): Record<string, FieldDefinition> {
  const resolved: Record<string, FieldDefinition> = {};
  for (const [key, builder] of Object.entries(fields)) {
    resolved[key] = builder.build();
  }
  return resolved;
}

export const s = {
  string(): StringFieldBuilder {
    return new StringFieldBuilder();
  },

  number(): NumberFieldBuilder {
    return new NumberFieldBuilder();
  },

  boolean(): BooleanFieldBuilder {
    return new BooleanFieldBuilder();
  },

  date(): DateFieldBuilder {
    return new DateFieldBuilder();
  },

  objectId(): ObjectIdFieldBuilder {
    return new ObjectIdFieldBuilder();
  },

  array<T>(items: { build(): FieldDefinition }): ArrayFieldBuilder<T> {
    return new ArrayFieldBuilder<T>(items.build());
  },

  object<T extends Record<string, unknown>>(
    properties: Record<string, { build(): FieldDefinition }>
  ): ObjectFieldBuilder<T> {
    const resolvedProps: Record<string, FieldDefinition> = {};
    for (const [key, builder] of Object.entries(properties)) {
      resolvedProps[key] = builder.build();
    }
    return new ObjectFieldBuilder<T>(resolvedProps);
  },

  json(): JsonFieldBuilder {
    return new JsonFieldBuilder();
  },

  literal<T extends string | number | boolean>(value: T): LiteralFieldBuilder<T> {
    return new LiteralFieldBuilder<T>(value);
  },

  enum<const E extends readonly string[]>(values: E): EnumFieldBuilder<E[number]> {
    return new EnumFieldBuilder<E[number]>(values);
  },
};

export { resolveFields, type SchemaFieldsInput };
