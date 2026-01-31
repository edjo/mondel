import {
  MongoClient,
  type Db,
  type MongoClientOptions,
  type IndexSpecification,
  type CreateIndexesOptions,
  type ClientSession,
  type ClientSessionOptions,
} from "mongodb";
import { CollectionProxy } from "../manager/collection-proxy";
import type { Schema, ValidationMode, SchemaToCollectionProxy, FieldDefinition } from "../types";
import { getFieldIndexes } from "../schema/define-schema";

type AnySchema = Schema<string, Record<string, FieldDefinition>>;

/**
 * Configuration for serverless environments (Cloudflare Workers, Vercel Edge, etc.)
 * Returns a factory function that creates connections on-demand.
 *
 * @template TSchemas - Tuple of schema types for type inference
 *
 * @example
 * ```typescript
 * const connectDb = createClient({
 *   serverless: true,
 *   schemas: [userSchema, postSchema] as const,
 *   syncIndexes: false, // Recommended for serverless
 *   validation: "strict"
 * });
 *
 * // Later, in request handler:
 * const db = await connectDb(env.MONGODB_URI);
 * ```
 */
export interface ServerlessClientConfig<TSchemas extends readonly AnySchema[]> {
  /** Must be true for serverless mode */
  serverless: true;
  /** Array of schemas to register (use `as const` for type inference) */
  schemas: TSchemas;
  /** Whether to sync indexes on connect (default: false for serverless) */
  syncIndexes?: boolean;
  /** Validation mode: "strict" | "loose" | "off" (default: "strict") */
  validation?: ValidationMode;
}

/**
 * Configuration for traditional Node.js environments.
 * Connects immediately and returns a ready-to-use client.
 *
 * @template TSchemas - Tuple of schema types for type inference
 *
 * @example
 * ```typescript
 * const db = await createClient({
 *   uri: process.env.MONGODB_URI,
 *   schemas: [userSchema, postSchema] as const,
 *   syncIndexes: true,
 *   validation: "strict"
 * });
 * ```
 */
export interface NodeClientConfig<TSchemas extends readonly AnySchema[]> {
  /** Set to false or omit for Node.js mode */
  serverless?: false;
  /** MongoDB connection URI (e.g., mongodb://localhost:27017/mydb) */
  uri: string;
  /** Array of schemas to register (use `as const` for type inference) */
  schemas: TSchemas;
  /** Whether to sync indexes on connect (default: true) */
  syncIndexes?: boolean;
  /** Validation mode: "strict" | "loose" | "off" (default: "strict") */
  validation?: ValidationMode;
  /** MongoDB driver options (maxPoolSize, etc.) */
  options?: MongoClientOptions;
}

/**
 * Union type of all client configurations.
 */
export type ClientConfig<TSchemas extends readonly AnySchema[]> =
  | ServerlessClientConfig<TSchemas>
  | NodeClientConfig<TSchemas>;

// Client methods type
type ClientMethods = {
  readonly close: () => Promise<void>;
  readonly getDb: () => Db;
  readonly startSession: (options?: ClientSessionOptions) => ClientSession;
};

// Extract schema names as a union type
type SchemaNames<TSchemas extends readonly AnySchema[]> = TSchemas[number]["name"];

// All valid keys for the client
type ValidClientKeys<TSchemas extends readonly AnySchema[]> =
  | SchemaNames<TSchemas>
  | keyof ClientMethods;

// Create a type that only allows access to valid keys
export type SchemasToClient<TSchemas extends readonly AnySchema[]> = {
  readonly [K in ValidClientKeys<TSchemas>]: K extends SchemaNames<TSchemas>
    ? SchemaToCollectionProxy<Extract<TSchemas[number], { name: K }>>
    : K extends keyof ClientMethods
      ? ClientMethods[K]
      : never;
};

async function syncIndexes(db: Db, schemas: readonly Schema[]): Promise<void> {
  for (const schema of schemas) {
    const collection = db.collection(schema.collection);

    const fieldIndexes = getFieldIndexes(schema);
    for (const { field, options } of fieldIndexes) {
      const indexSpec: IndexSpecification = {
        [field]: options.type ?? 1,
      };
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

      await collection.createIndex(indexSpec, indexOptions);
    }

    for (const index of schema.indexes) {
      const indexSpec: IndexSpecification = index.fields as IndexSpecification;
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

      await collection.createIndex(indexSpec, indexOptions);
    }
  }
}

function createClientProxy<TSchemas extends readonly AnySchema[]>(
  client: MongoClient,
  db: Db,
  schemas: TSchemas,
  validationMode: ValidationMode
): SchemasToClient<TSchemas> {
  const schemaMap = new Map<string, Schema>();
  const proxyCache = new Map<string, CollectionProxy<Schema>>();

  for (const schema of schemas) {
    schemaMap.set(schema.name, schema);
  }

  const baseClient = {
    async close() {
      await client.close();
    },
    getDb() {
      return db;
    },
    startSession(options?: ClientSessionOptions) {
      return client.startSession(options);
    },
  };

  // Properties that should return undefined (not collections)
  const IGNORED_PROPERTIES = new Set([
    "then",
    "catch",
    "finally",
    "inspect",
    "nodeType",
    "toJSON",
    "constructor",
    "prototype",
    "__proto__",
  ]);

  return new Proxy(baseClient as SchemasToClient<TSchemas>, {
    get(target, prop: string | symbol) {
      if (typeof prop === "symbol") {
        return Reflect.get(target, prop);
      }

      if (IGNORED_PROPERTIES.has(prop)) {
        return undefined;
      }

      if (prop in target) {
        const value = target[prop as keyof typeof target];
        if (typeof value === "function") {
          return value.bind(target);
        }
        return value;
      }

      const schema = schemaMap.get(prop);
      if (schema) {
        let proxy = proxyCache.get(prop);
        if (!proxy) {
          proxy = new CollectionProxy(db, schema, validationMode);
          proxyCache.set(prop, proxy);
        }
        return proxy;
      }

      return undefined;
    },

    has(target, prop: string | symbol) {
      if (typeof prop === "symbol") return false;
      if (IGNORED_PROPERTIES.has(prop)) return false;
      return prop in target || schemaMap.has(prop);
    },

    ownKeys(target) {
      const baseKeys = Reflect.ownKeys(target);
      const schemaNames = Array.from(schemaMap.keys());
      return [...new Set([...baseKeys, ...schemaNames])];
    },
  });
}

/**
 * Create a type-safe MongoDB client with schema-based collection access.
 *
 * **Serverless Mode** (recommended for Cloudflare Workers, Vercel Edge):
 * Returns a factory function that creates connections on-demand.
 *
 * @param config - Client configuration with `serverless: true`
 * @returns Factory function: `(uri: string, options?) => Promise<Client>`
 *
 * @example
 * ```typescript
 * import { createClient, type SchemasToClient } from "mondel";
 * import { userSchema, postSchema } from "./schemas";
 *
 * const schemas = [userSchema, postSchema] as const;
 * export type DbClient = SchemasToClient<typeof schemas>;
 *
 * // Create factory (no connection yet)
 * const connectDb = createClient({
 *   serverless: true,
 *   schemas,
 *   syncIndexes: false,
 *   validation: "strict"
 * });
 *
 * // In request handler
 * export async function handleRequest(env: Env) {
 *   const db = await connectDb(env.MONGODB_URI);
 *   const users = await db.users.findMany({ isActive: true });
 *   await db.close();
 *   return users;
 * }
 * ```
 */
export function createClient<const TSchemas extends readonly AnySchema[]>(
  config: ServerlessClientConfig<TSchemas>
): (uri: string, options?: MongoClientOptions) => Promise<SchemasToClient<TSchemas>>;

/**
 * Create a type-safe MongoDB client with schema-based collection access.
 *
 * **Node.js Mode** (for traditional servers, scripts, tests):
 * Connects immediately and returns a ready-to-use client.
 *
 * @param config - Client configuration with `serverless: false` or omitted
 * @returns Promise resolving to connected client
 *
 * @example
 * ```typescript
 * import { createClient } from "mondel";
 * import { userSchema, postSchema } from "./schemas";
 *
 * async function main() {
 *   const db = await createClient({
 *     uri: process.env.MONGODB_URI!,
 *     schemas: [userSchema, postSchema] as const,
 *     syncIndexes: true,
 *     validation: "strict"
 *   });
 *
 *   // Type-safe access to collections
 *   const users = await db.users.findMany({ role: "ADMIN" });
 *
 *   // Close when done
 *   await db.close();
 * }
 * ```
 */
export function createClient<const TSchemas extends readonly AnySchema[]>(
  config: NodeClientConfig<TSchemas>
): Promise<SchemasToClient<TSchemas>>;

// Implementation
export function createClient<const TSchemas extends readonly AnySchema[]>(
  config: ClientConfig<TSchemas>
):
  | ((uri: string, options?: MongoClientOptions) => Promise<SchemasToClient<TSchemas>>)
  | Promise<SchemasToClient<TSchemas>> {
  const { schemas, syncIndexes: shouldSyncIndexes = false, validation = "strict" } = config;

  if (config.serverless === true) {
    // Serverless mode: return factory function
    return async (uri: string, options?: MongoClientOptions) => {
      const client = new MongoClient(uri, options);
      await client.connect();
      const db = client.db();

      if (shouldSyncIndexes) {
        await syncIndexes(db, schemas);
      }

      return createClientProxy(client, db, schemas, validation);
    };
  } else {
    // Node.js mode: connect immediately
    return (async () => {
      const client = new MongoClient(config.uri, config.options);
      await client.connect();
      const db = client.db();

      if (shouldSyncIndexes) {
        await syncIndexes(db, schemas);
      }

      return createClientProxy(client, db, schemas, validation);
    })();
  }
}
