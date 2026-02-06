import {
  ObjectId,
  type Collection,
  type Db,
  type Document,
  type Filter,
  type FindOptions as MongoFindOptions,
  type UpdateFilter,
  type OptionalUnlessRequiredId,
  type WithId,
  type InsertOneResult,
  type InsertManyResult,
  type UpdateResult,
  type DeleteResult,
  type CountDocumentsOptions,
  type AggregateOptions,
} from "mongodb";
import type {
  Schema,
  FindOptions,
  CreateOptions,
  CreateManyOptions,
  UpdateOptions,
  DeleteOptions,
  ValidationMode,
} from "../types";
import { zodCreateSchema, zodUpdateSchema } from "../validation/zod-schema";

/**
 * Type-safe collection proxy for MongoDB operations.
 * Provides CRUD methods with full TypeScript support and Zod validation.
 *
 * @template TSchema - The schema type for this collection
 *
 * @example
 * ```typescript
 * // Access via client
 * const db = await getMondelClient(env);
 * const users = await db.users.findMany({ isActive: true });
 * ```
 */
export class CollectionProxy<TSchema extends Schema> {
  private collection: Collection<Document>;
  private schema: TSchema;
  private validationMode: ValidationMode;

  constructor(db: Db, schema: TSchema, validationMode: ValidationMode = "strict") {
    this.collection = db.collection(schema.collection);
    this.schema = schema;
    this.validationMode = validationMode;
  }

  private validateCreate(data: Document): void {
    if (this.validationMode === "off") return;

    const zodSchema = zodCreateSchema(this.schema);
    const result = zodSchema.safeParse(data);

    if (!result.success) {
      if (this.validationMode === "strict") {
        throw result.error;
      }
      console.warn(`Validation warning: ${result.error.message}`);
    }
  }

  private validateUpdate(data: Document): void {
    if (this.validationMode === "off") return;

    const zodSchema = zodUpdateSchema(this.schema);
    const result = zodSchema.safeParse(data);

    if (!result.success) {
      if (this.validationMode === "strict") {
        throw result.error;
      }
      console.warn(`Validation warning: ${result.error.message}`);
    }
  }

  /**
   * Find a single document matching the filter.
   *
   * @param where - MongoDB filter query
   * @param options - Find options (select, sort, skip, limit, session)
   * @returns The matching document or null
   *
   * @example
   * ```typescript
   * // Find by email
   * const user = await db.users.findOne({ email: "john@example.com" });
   *
   * // With field selection
   * const user = await db.users.findOne(
   *   { email: "john@example.com" },
   *   { select: { _id: true, email: true, name: true } }
   * );
   *
   * // With session (for transactions)
   * const user = await db.users.findOne(
   *   { email: "john@example.com" },
   *   { session }
   * );
   * ```
   */
  async findOne(
    where: Filter<Document>,
    options?: FindOptions<TSchema>
  ): Promise<WithId<Document> | null> {
    const mongoOptions: MongoFindOptions = {};
    if (options?.session) {
      mongoOptions.session = options.session;
    }

    if (options?.select) {
      mongoOptions.projection = options.select as Document;
    }
    if (options?.sort) {
      mongoOptions.sort = options.sort;
    }

    return this.collection.findOne(where, mongoOptions);
  }

  /**
   * Find multiple documents matching the filter.
   *
   * @param where - MongoDB filter query (optional, defaults to {})
   * @param options - Find options (select, sort, skip, limit, session)
   * @returns Array of matching documents
   *
   * @example
   * ```typescript
   * // Find all active users
   * const users = await db.users.findMany({ isActive: true });
   *
   * // With pagination and sorting
   * const users = await db.users.findMany(
   *   { role: "ADMIN" },
   *   {
   *     select: { _id: true, email: true, name: true },
   *     sort: { createdAt: -1 },
   *     skip: 0,
   *     limit: 10
   *   }
   * );
   *
   * // Using MongoDB operators
   * const users = await db.users.findMany({
   *   age: { $gte: 18, $lte: 65 },
   *   role: { $in: ["ADMIN", "MODERATOR"] }
   * });
   * ```
   */
  async findMany(
    where: Filter<Document> = {},
    options?: FindOptions<TSchema>
  ): Promise<WithId<Document>[]> {
    const mongoOptions: MongoFindOptions = {};
    if (options?.session) {
      mongoOptions.session = options.session;
    }

    let cursor = this.collection.find(where, mongoOptions);

    if (options?.select) {
      cursor = cursor.project(options.select as Document);
    }
    if (options?.sort) {
      cursor = cursor.sort(options.sort);
    }
    if (options?.skip !== undefined) {
      cursor = cursor.skip(options.skip);
    }
    if (options?.limit !== undefined) {
      cursor = cursor.limit(options.limit);
    }

    return cursor.toArray();
  }

  /**
   * Find a document by its _id.
   *
   * @param id - ObjectId or string representation
   * @param options - Find options (select, session)
   * @returns The matching document or null
   *
   * @example
   * ```typescript
   * // Find by string ID
   * const user = await db.users.findById("507f1f77bcf86cd799439011");
   *
   * // Find by ObjectId
   * const user = await db.users.findById(new ObjectId("507f1f77bcf86cd799439011"));
   *
   * // With field selection
   * const user = await db.users.findById(userId, {
   *   select: { email: true, name: true }
   * });
   * ```
   */
  async findById(
    id: ObjectId | string,
    options?: FindOptions<TSchema>
  ): Promise<WithId<Document> | null> {
    const objectId = this.parseObjectId(id);
    const mongoOptions: MongoFindOptions = { ...options };

    if (options?.select) {
      mongoOptions.projection = options.select as Document;
      delete (mongoOptions as Record<string, unknown>).select;
    }

    return this.collection.findOne({ _id: objectId }, mongoOptions);
  }

  /**
   * Create a new document.
   * Automatically adds timestamps if enabled in schema.
   *
   * @param data - Document data (validated against schema)
   * @param options - Create options (timestamps, session)
   * @returns Insert result with insertedId
   *
   * @example
   * ```typescript
   * // Create a user
   * const result = await db.users.create({
   *   email: "john@example.com",
   *   name: "John Doe",
   *   role: "USER"
   * });
   * console.log(result.insertedId); // ObjectId
   *
   * // Disable automatic timestamps
   * await db.users.create(userData, { timestamps: false });
   *
   * // With session (for transactions)
   * await db.users.create(userData, { session });
   * ```
   */
  async create(
    data: OptionalUnlessRequiredId<Document>,
    options?: CreateOptions
  ): Promise<InsertOneResult> {
    this.validateCreate(data);
    const doc = this.applyTimestamps(data, "create", options?.timestamps);
    const { timestamps: _timestamps, ...mongoOptions } = options || {};
    void _timestamps;
    return this.collection.insertOne(doc, mongoOptions);
  }

  /**
   * Create multiple documents in a single operation.
   * Automatically adds timestamps if enabled in schema.
   *
   * @param data - Array of document data
   * @param options - Create options (timestamps, ordered, session)
   * @returns Insert result with insertedIds
   *
   * @example
   * ```typescript
   * // Create multiple users
   * const result = await db.users.createMany([
   *   { email: "user1@example.com", name: "User 1" },
   *   { email: "user2@example.com", name: "User 2" },
   *   { email: "user3@example.com", name: "User 3" }
   * ]);
   * console.log(result.insertedIds); // { 0: ObjectId, 1: ObjectId, 2: ObjectId }
   *
   * // With session (for transactions)
   * await db.users.createMany(usersData, { session });
   * ```
   */
  async createMany(
    data: OptionalUnlessRequiredId<Document>[],
    options?: CreateManyOptions
  ): Promise<InsertManyResult> {
    for (const item of data) {
      this.validateCreate(item);
    }
    const docs = data.map((d) => this.applyTimestamps(d, "create", options?.timestamps));
    const { timestamps: _timestamps, ...mongoOptions } = options || {};
    void _timestamps;
    return this.collection.insertMany(docs, mongoOptions);
  }

  /**
   * Update a single document matching the filter.
   * Supports both simple updates and MongoDB update operators.
   *
   * @param where - MongoDB filter query
   * @param data - Update data or MongoDB update operators ($set, $inc, etc.)
   * @param options - Update options (upsert, timestamps, session)
   * @returns Update result with matchedCount, modifiedCount, upsertedId
   *
   * @example
   * ```typescript
   * // Simple update (automatically wrapped in $set)
   * await db.users.updateOne(
   *   { email: "john@example.com" },
   *   { name: "John Smith" }
   * );
   *
   * // Using MongoDB operators
   * await db.users.updateOne(
   *   { _id: userId },
   *   { $set: { name: "John" }, $inc: { loginCount: 1 } }
   * );
   *
   * // Upsert - create if not exists
   * await db.users.updateOne(
   *   { email: "john@example.com" },
   *   { $set: { name: "John", isActive: true } },
   *   { upsert: true }
   * );
   *
   * // With session (for transactions)
   * await db.users.updateOne(filter, update, { session });
   * ```
   */
  async updateOne(
    where: Filter<Document>,
    data: Document,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    // Only validate if data is a plain update object (not using operators like $set)
    const hasOperators = Object.keys(data).some((k) => k.startsWith("$"));
    if (!hasOperators) {
      this.validateUpdate(data);
    }
    const update = this.applyUpdateTimestamps(data, hasOperators, options);
    const { timestamps: _timestamps, ...mongoOptions } = options || {};
    void _timestamps;
    return this.collection.updateOne(where, update as UpdateFilter<Document>, mongoOptions);
  }

  /**
   * Update multiple documents matching the filter.
   * Supports both simple updates and MongoDB update operators.
   *
   * @param where - MongoDB filter query
   * @param data - Update data or MongoDB update operators
   * @param options - Update options (upsert, timestamps, session)
   * @returns Update result with matchedCount, modifiedCount
   *
   * @example
   * ```typescript
   * // Deactivate all users with expired subscriptions
   * await db.users.updateMany(
   *   { subscriptionExpiry: { $lt: new Date() } },
   *   { $set: { isActive: false } }
   * );
   *
   * // Increment login count for all admins
   * await db.users.updateMany(
   *   { role: "ADMIN" },
   *   { $inc: { loginCount: 1 } }
   * );
   * ```
   */
  async updateMany(
    where: Filter<Document>,
    data: Document,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    const hasOperators = Object.keys(data).some((k) => k.startsWith("$"));
    if (!hasOperators) {
      this.validateUpdate(data);
    }
    const update = this.applyUpdateTimestamps(data, hasOperators, options);
    const { timestamps: _timestamps, ...mongoOptions } = options || {};
    void _timestamps;
    return this.collection.updateMany(where, update as UpdateFilter<Document>, mongoOptions);
  }

  /**
   * Update a document by its _id.
   * Convenience method that wraps updateOne with _id filter.
   *
   * @param id - ObjectId or string representation
   * @param data - Update data or MongoDB update operators
   * @param options - Update options (upsert, timestamps, session)
   * @returns Update result with matchedCount, modifiedCount
   *
   * @example
   * ```typescript
   * // Update by ID
   * await db.users.updateById(userId, { name: "New Name" });
   *
   * // Using operators
   * await db.users.updateById(userId, {
   *   $set: { name: "New Name" },
   *   $push: { tags: "premium" }
   * });
   * ```
   */
  async updateById(
    id: ObjectId | string,
    data: Document,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    const objectId = this.parseObjectId(id);
    return this.updateOne({ _id: objectId }, data, options);
  }

  /**
   * Delete a single document matching the filter.
   *
   * @param where - MongoDB filter query
   * @param options - Delete options (session)
   * @returns Delete result with deletedCount
   *
   * @example
   * ```typescript
   * // Delete by email
   * await db.users.deleteOne({ email: "john@example.com" });
   *
   * // With session (for transactions)
   * await db.users.deleteOne({ _id: userId }, { session });
   * ```
   */
  async deleteOne(where: Filter<Document>, options?: DeleteOptions): Promise<DeleteResult> {
    const { soft: _soft, ...mongoOptions } = options || {};
    void _soft;
    return this.collection.deleteOne(where, mongoOptions);
  }

  /**
   * Delete multiple documents matching the filter.
   *
   * @param where - MongoDB filter query
   * @param options - Delete options (session)
   * @returns Delete result with deletedCount
   *
   * @example
   * ```typescript
   * // Delete all inactive users
   * const result = await db.users.deleteMany({ isActive: false });
   * console.log(`Deleted ${result.deletedCount} users`);
   *
   * // Delete users created before a date
   * await db.users.deleteMany({
   *   createdAt: { $lt: new Date("2023-01-01") }
   * });
   * ```
   */
  async deleteMany(where: Filter<Document>, options?: DeleteOptions): Promise<DeleteResult> {
    const { soft: _soft, ...mongoOptions } = options || {};
    void _soft;
    return this.collection.deleteMany(where, mongoOptions);
  }

  /**
   * Delete a document by its _id.
   *
   * @param id - ObjectId or string representation
   * @param options - Delete options (session)
   * @returns Delete result with deletedCount
   *
   * @example
   * ```typescript
   * await db.users.deleteById("507f1f77bcf86cd799439011");
   * await db.users.deleteById(userId, { session });
   * ```
   */
  async deleteById(id: ObjectId | string, options?: DeleteOptions): Promise<DeleteResult> {
    const objectId = this.parseObjectId(id);
    return this.deleteOne({ _id: objectId }, options);
  }

  /**
   * Count documents matching the filter.
   *
   * @param where - MongoDB filter query (optional)
   * @param options - Count options (limit, skip, session)
   * @returns Number of matching documents
   *
   * @example
   * ```typescript
   * // Count all users
   * const total = await db.users.count();
   *
   * // Count active users
   * const activeCount = await db.users.count({ isActive: true });
   *
   * // Count with limit (for existence check optimization)
   * const hasAdmins = await db.users.count({ role: "ADMIN" }, { limit: 1 }) > 0;
   * ```
   */
  async count(where: Filter<Document> = {}, options?: CountDocumentsOptions): Promise<number> {
    return this.collection.countDocuments(where, options);
  }

  /**
   * Check if any document matches the filter.
   * Optimized to stop after finding first match.
   *
   * @param where - MongoDB filter query
   * @param options - Count options (session)
   * @returns true if at least one document matches
   *
   * @example
   * ```typescript
   * // Check if email is taken
   * const emailTaken = await db.users.exists({ email: "john@example.com" });
   *
   * // Check if user has admin role
   * const isAdmin = await db.users.exists({ _id: userId, role: "ADMIN" });
   * ```
   */
  async exists(where: Filter<Document>, options?: CountDocumentsOptions): Promise<boolean> {
    const count = await this.collection.countDocuments(where, { ...options, limit: 1 });
    return count > 0;
  }

  /**
   * Run an aggregation pipeline.
   * Provides full access to MongoDB aggregation framework.
   *
   * @param pipeline - Array of aggregation stages
   * @param options - Aggregation options (allowDiskUse, session)
   * @returns Array of aggregation results
   *
   * @example
   * ```typescript
   * // Group users by role and count
   * const stats = await db.users.aggregate([
   *   { $match: { isActive: true } },
   *   { $group: { _id: "$role", count: { $sum: 1 } } },
   *   { $sort: { count: -1 } }
   * ]);
   *
   * // Lookup related documents
   * const usersWithPosts = await db.users.aggregate([
   *   { $lookup: {
   *       from: "posts",
   *       localField: "_id",
   *       foreignField: "authorId",
   *       as: "posts"
   *   }}
   * ]);
   *
   * // With options
   * const bigResult = await db.users.aggregate(pipeline, {
   *   allowDiskUse: true
   * });
   * ```
   */
  async aggregate(pipeline: Document[], options?: AggregateOptions): Promise<Document[]> {
    return this.collection.aggregate(pipeline, options).toArray();
  }

  /**
   * Get the underlying MongoDB Collection instance.
   * Use for advanced operations not covered by the proxy.
   *
   * @returns MongoDB Collection instance
   *
   * @example
   * ```typescript
   * const collection = db.users.getCollection();
   *
   * // Use for watch, bulkWrite, or other advanced operations
   * const changeStream = collection.watch();
   * ```
   */
  getCollection(): Collection<Document> {
    return this.collection;
  }

  private applyTimestamps(
    data: Document,
    operation: "create" | "update",
    enabled?: boolean
  ): Document {
    if (enabled === false || !this.schema.timestamps) {
      return data;
    }

    const timestamps = this.schema.timestamps;
    const now = new Date();
    const result = { ...data };

    if (operation === "create" && timestamps.createdAt) {
      result[timestamps.createdAt] = now;
    }
    if (timestamps.updatedAt) {
      result[timestamps.updatedAt] = now;
    }

    return result;
  }

  private parseObjectId(id: ObjectId | string): ObjectId {
    return typeof id === "string" ? new ObjectId(id) : id;
  }

  private applyUpdateTimestamps(
    data: Document,
    hasOperators: boolean,
    options?: UpdateOptions
  ): UpdateFilter<Document> {
    const schemaTimestamps = this.schema.timestamps;

    // If no processing needed, return data as-is (or wrapped in $set if no operators)
    if (!schemaTimestamps) {
      return hasOperators ? (data as UpdateFilter<Document>) : { $set: data };
    }

    const timestamps = schemaTimestamps;
    const now = new Date();

    // Initialize update object
    const update: UpdateFilter<Document> = hasOperators ? { ...data } : { $set: { ...data } };

    // 1. Handle updatedAt in $set
    if (timestamps.updatedAt) {
      update.$set = update.$set || {};
      // Only set if not already present in the update data
      if (!(timestamps.updatedAt in update.$set)) {
        update.$set[timestamps.updatedAt] = now;
      }
    }

    // 2. Handle createdAt in $setOnInsert (only if upsert is true)
    if (options?.upsert && timestamps.createdAt) {
      update.$setOnInsert = update.$setOnInsert || {};
      // Only set if not already present
      if (!(timestamps.createdAt in update.$setOnInsert)) {
        update.$setOnInsert[timestamps.createdAt] = now;
      }
    }

    return update;
  }
}
