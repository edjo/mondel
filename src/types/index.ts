import type {
  ObjectId,
  Document,
  Filter,
  Sort,
  MongoClientOptions,
  UpdateOptions as MongoUpdateOptions,
  DeleteOptions as MongoDeleteOptions,
  InsertOneOptions,
  BulkWriteOptions,
  FindOptions as MongoFindOptions,
  CountDocumentsOptions,
  AggregateOptions,
  ClientSession,
} from "mongodb";
import type { z } from "zod";

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "objectId"
  | "array"
  | "object"
  | "json"
  | "literal";

export interface IndexOptions {
  type?: 1 | -1 | "text" | "2dsphere" | "2d";
  name?: string;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Document;
}

export interface CompoundIndexDefinition {
  fields: Record<string, 1 | -1 | "text" | "2dsphere" | "2d">;
  options?: {
    name?: string;
    unique?: boolean;
    sparse?: boolean;
    partialFilterExpression?: Document;
    weights?: Record<string, number>;
  };
}

export interface FieldDefinition<T = unknown> {
  type: FieldType;
  required: boolean;
  unique: boolean;
  default?: T | "auto";
  index?: IndexOptions;
  enum?: readonly string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  items?: FieldDefinition;
  properties?: Record<string, FieldDefinition>;
  literal?: string | number | boolean;
}

export interface TimestampConfig {
  createdAt?: string;
  updatedAt?: string;
}

export interface ValidationConfig {
  enabled?: boolean;
  mode?: "strict" | "loose" | "off";
}

export interface SchemaDefinition<
  TFields extends Record<string, FieldDefinition> = Record<string, FieldDefinition>,
> {
  collection?: string;
  timestamps?: boolean | TimestampConfig;
  validation?: ValidationConfig;
  connection?: string;
  fields: TFields;
  indexes?: CompoundIndexDefinition[];
}

export interface Schema<
  TName extends string = string,
  TFields extends Record<string, FieldDefinition> = Record<string, FieldDefinition>,
> {
  name: TName;
  collection: string;
  timestamps: TimestampConfig | false;
  validation: ValidationConfig;
  connection?: string;
  fields: TFields;
  indexes: CompoundIndexDefinition[];
}

export interface ConnectionConfig {
  uri: string;
  options?: MongoClientOptions;
}

export interface ManagerConfig<
  TSchemas extends readonly Schema<string, Record<string, FieldDefinition>>[] = readonly Schema[],
> {
  uri: string;
  options?: MongoClientOptions;
  schemas: TSchemas;
  /**
   * @deprecated Avoid syncing indexes during startup. Prefer `mondel push` or a dedicated sync script.
   */
  syncIndexes?: boolean;
  validation?: ValidationMode;
}

export type ValidationMode = "strict" | "loose" | "off";

export interface ConnectionManagerConfig {
  [name: string]: ConnectionConfig;
}

export type InferFieldType<T extends FieldDefinition> = T extends { type: "string" }
  ? T extends { enum: readonly (infer E)[] }
    ? E
    : string
  : T extends { type: "number" }
    ? number
    : T extends { type: "boolean" }
      ? boolean
      : T extends { type: "date" }
        ? Date
        : T extends { type: "objectId" }
          ? ObjectId
          : T extends { type: "array"; items: infer I extends FieldDefinition }
            ? InferFieldType<I>[]
            : T extends {
                  type: "object";
                  properties: infer P extends Record<string, FieldDefinition>;
                }
              ? { [K in keyof P]: InferFieldType<P[K]> }
              : T extends { type: "json" }
                ? unknown
                : T extends { type: "literal"; literal: infer L }
                  ? L
                  : unknown;

// Infer type from field builder
type InferBuilderValue<T> = T extends { build(): FieldDefinition<infer V> } ? V : unknown;

// Extract timestamp field names from schema
type TimestampFields<T extends Schema> = T["timestamps"] extends false
  ? never
  : T["timestamps"] extends { createdAt?: infer C; updatedAt?: infer U }
    ? (C extends string ? C : "createdAt") | (U extends string ? U : "updatedAt")
    : "createdAt" | "updatedAt";

// Timestamp fields as object type
type TimestampFieldsType<T extends Schema> = T["timestamps"] extends false
  ? object
  : T["timestamps"] extends { createdAt?: infer C; updatedAt?: infer U }
    ? { [K in C extends string ? C : "createdAt"]?: Date } & {
        [K in U extends string ? U : "updatedAt"]?: Date;
      }
    : { createdAt?: Date; updatedAt?: Date };

// Main type inference - includes _id and timestamp fields automatically
// _id is always present in MongoDB documents (required, not optional)
export type InferSchemaType<T extends Schema> = { _id: ObjectId } & (T extends {
  __fields: infer TFields;
}
  ? { [K in keyof TFields]?: InferBuilderValue<TFields[K]> }
  : {
      [K in keyof T["fields"]]?: InferFieldType<T["fields"][K]>;
    }) &
  TimestampFieldsType<T>;

export type CreateInput<T extends Schema> = Omit<InferSchemaType<T>, "_id" | TimestampFields<T>>;

export type UpdateInput<T extends Schema> = Partial<
  Omit<InferSchemaType<T>, "_id" | TimestampFields<T>>
>;

export type WhereInput<T extends Schema> = Filter<InferSchemaType<T>>;

// SelectInput includes _id, schema fields, and timestamp fields
export type SelectInput<T extends Schema> = {
  _id?: boolean | 0 | 1;
} & {
  [K in keyof T["fields"]]?: boolean | 0 | 1;
} & (T["timestamps"] extends false
    ? object
    : T["timestamps"] extends { createdAt?: infer C; updatedAt?: infer U }
      ? { [K in C extends string ? C : "createdAt"]?: boolean | 0 | 1 } & {
          [K in U extends string ? U : "updatedAt"]?: boolean | 0 | 1;
        }
      : { createdAt?: boolean | 0 | 1; updatedAt?: boolean | 0 | 1 });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type SortInput<T extends Schema> = Sort;

export interface FindOptions<T extends Schema> extends Omit<
  MongoFindOptions,
  "projection" | "sort"
> {
  select?: SelectInput<T>;
  sort?: SortInput<T>;
  skip?: number;
  limit?: number;
}

export interface CreateOptions extends InsertOneOptions {
  timestamps?: boolean;
}

export interface CreateManyOptions extends BulkWriteOptions {
  timestamps?: boolean;
}

export interface UpdateOptions extends MongoUpdateOptions {
  timestamps?: boolean;
}

export interface DeleteOptions extends MongoDeleteOptions {
  soft?: boolean;
}

export interface CountOptions extends CountDocumentsOptions {}

export interface AggregateOpts extends AggregateOptions {}

export type { ClientSession };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ZodSchemaMap<T extends Schema> = z.ZodType<InferSchemaType<T>>;

export type SchemaToCollectionProxy<
  TSchema extends Schema<string, Record<string, FieldDefinition>>,
> = {
  findOne(
    where?: Filter<InferSchemaType<TSchema>>,
    options?: FindOptions<TSchema>
  ): Promise<InferSchemaType<TSchema> | null>;
  findMany(
    where?: Filter<InferSchemaType<TSchema>>,
    options?: FindOptions<TSchema>
  ): Promise<InferSchemaType<TSchema>[]>;
  findById(
    id: ObjectId | string,
    options?: FindOptions<TSchema>
  ): Promise<InferSchemaType<TSchema> | null>;
  create(
    data: CreateInput<TSchema>,
    options?: CreateOptions
  ): Promise<{ insertedId: ObjectId } & InferSchemaType<TSchema>>;
  createMany(
    data: CreateInput<TSchema>[],
    options?: CreateManyOptions
  ): Promise<{ insertedIds: Record<number, ObjectId> }>;
  updateOne(
    where: Filter<InferSchemaType<TSchema>>,
    data: UpdateInput<TSchema> | Document,
    options?: UpdateOptions
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedId?: ObjectId }>;
  updateMany(
    where: Filter<InferSchemaType<TSchema>>,
    data: UpdateInput<TSchema> | Document,
    options?: UpdateOptions
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedId?: ObjectId }>;
  updateById(
    id: ObjectId | string,
    data: UpdateInput<TSchema> | Document,
    options?: UpdateOptions
  ): Promise<{ matchedCount: number; modifiedCount: number }>;
  deleteOne(
    where: Filter<InferSchemaType<TSchema>>,
    options?: DeleteOptions
  ): Promise<{ deletedCount: number }>;
  deleteMany(
    where: Filter<InferSchemaType<TSchema>>,
    options?: DeleteOptions
  ): Promise<{ deletedCount: number }>;
  deleteById(id: ObjectId | string, options?: DeleteOptions): Promise<{ deletedCount: number }>;
  count(where?: Filter<InferSchemaType<TSchema>>, options?: CountOptions): Promise<number>;
  exists(where: Filter<InferSchemaType<TSchema>>, options?: CountOptions): Promise<boolean>;
  aggregate<T = InferSchemaType<TSchema>>(
    pipeline: Document[],
    options?: AggregateOpts
  ): Promise<T[]>;
  getCollection(): import("mongodb").Collection;
};

// Manager methods type
type ManagerMethods = {
  readonly disconnect: () => Promise<void>;
  readonly isConnected: () => boolean;
  readonly getDb: () => import("mongodb").Db;
  readonly getSchema: (name: string) => Schema | undefined;
};

// Extract schema names as a union type
type SchemaNames<TSchemas extends readonly Schema<string, Record<string, FieldDefinition>>[]> =
  TSchemas[number]["name"];

// All valid keys for the manager
type ValidManagerKeys<TSchemas extends readonly Schema<string, Record<string, FieldDefinition>>[]> =
  | SchemaNames<TSchemas>
  | keyof ManagerMethods;

// Create a type that only allows access to valid keys
// Using a mapped type with explicit key constraint
export type SchemasToManager<
  TSchemas extends readonly Schema<string, Record<string, FieldDefinition>>[],
> = {
  readonly [K in ValidManagerKeys<TSchemas>]: K extends SchemaNames<TSchemas>
    ? SchemaToCollectionProxy<Extract<TSchemas[number], { name: K }>>
    : K extends keyof ManagerMethods
      ? ManagerMethods[K]
      : never;
};
