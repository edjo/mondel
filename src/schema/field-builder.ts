import type { FieldDefinition, IndexOptions } from "../types";

// Branded type for TypeScript inference
declare const __type: unique symbol;
declare const __required: unique symbol;

export class FieldBuilder<T = unknown, TRequired extends boolean = false> {
  private definition: FieldDefinition<T>;

  // Branded types for inference (not used at runtime)
  declare readonly [__type]: T;
  declare readonly [__required]: TRequired;

  constructor(type: FieldDefinition["type"]) {
    this.definition = {
      type,
      required: false,
      unique: false,
    };
  }

  required(): FieldBuilder<T, true> {
    this.definition.required = true;
    return this as unknown as FieldBuilder<T, true>;
  }

  unique(): this {
    this.definition.unique = true;
    return this;
  }

  default(value: T | "auto"): this {
    this.definition.default = value;
    return this;
  }

  index(options?: IndexOptions): this {
    this.definition.index = options ?? { type: 1 };
    return this;
  }

  build(): FieldDefinition<T> {
    return { ...this.definition };
  }
}

// Helper types for extracting field info
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type InferBuilderType<T> = T extends FieldBuilder<infer V, infer _R> ? V : unknown;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type IsBuilderRequired<T> = T extends FieldBuilder<infer _V, infer R> ? R : false;

export class StringFieldBuilder extends FieldBuilder<string> {
  constructor() {
    super("string");
  }

  min(length: number): this {
    (this as unknown as { definition: FieldDefinition<string> }).definition.minLength = length;
    return this;
  }

  max(length: number): this {
    (this as unknown as { definition: FieldDefinition<string> }).definition.maxLength = length;
    return this;
  }

  pattern(regex: RegExp): this {
    (this as unknown as { definition: FieldDefinition<string> }).definition.pattern = regex;
    return this;
  }

  email(): this {
    (this as unknown as { definition: FieldDefinition<string> }).definition.email = true;
    return this;
  }

  url(): this {
    (this as unknown as { definition: FieldDefinition<string> }).definition.url = true;
    return this;
  }

  text(): this {
    return this.index({ type: "text" });
  }

  enum<const E extends readonly string[]>(values: E): EnumFieldBuilder<E[number]> {
    const builder = new EnumFieldBuilder<E[number]>(values);
    const def = this.build();
    if (def.required) builder.required();
    if (def.unique) builder.unique();
    if (def.index) builder.index(def.index);
    return builder;
  }
}

export class EnumFieldBuilder<T extends string> extends FieldBuilder<T> {
  constructor(values: readonly T[]) {
    super("string");
    (this as unknown as { definition: FieldDefinition<T> }).definition.enum = values;
  }
}

export class NumberFieldBuilder extends FieldBuilder<number> {
  constructor() {
    super("number");
  }

  min(value: number): this {
    (this as unknown as { definition: FieldDefinition<number> }).definition.min = value;
    return this;
  }

  max(value: number): this {
    (this as unknown as { definition: FieldDefinition<number> }).definition.max = value;
    return this;
  }
}

export class BooleanFieldBuilder extends FieldBuilder<boolean> {
  constructor() {
    super("boolean");
  }
}

export class DateFieldBuilder extends FieldBuilder<Date> {
  constructor() {
    super("date");
  }
}

export class ObjectIdFieldBuilder extends FieldBuilder<unknown> {
  constructor() {
    super("objectId");
  }
}

export class ArrayFieldBuilder<T> extends FieldBuilder<T[]> {
  constructor(items: FieldDefinition) {
    super("array");
    (this as unknown as { definition: FieldDefinition<T[]> }).definition.items = items;
  }
}

export class ObjectFieldBuilder<T extends Record<string, unknown>> extends FieldBuilder<T> {
  constructor(properties: Record<string, FieldDefinition>) {
    super("object");
    (this as unknown as { definition: FieldDefinition<T> }).definition.properties = properties;
  }
}

export class JsonFieldBuilder extends FieldBuilder<unknown> {
  constructor() {
    super("json");
  }
}

export class LiteralFieldBuilder<T extends string | number | boolean> extends FieldBuilder<T> {
  constructor(value: T) {
    super("literal");
    (this as unknown as { definition: FieldDefinition<T> }).definition.literal = value;
  }
}
