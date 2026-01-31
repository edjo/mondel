/**
 * Basic Usage Example - Mondel ORM
 *
 * This example demonstrates the core features of Mondel:
 * - Schema definition with field builders
 * - Creating a client connection
 * - CRUD operations with type safety
 * - Aggregation pipelines
 */
import { schema, s, createClient } from "../src";

// ============================================================
// Schema Definitions
// ============================================================

const userSchema = schema("users", {
  timestamps: true,
  fields: {
    email: s.string().required().unique().index({ name: "idx_email" }),
    name: s.string(),
    role: s.enum(["ADMIN", "USER", "GUEST"]).default("USER"),
    age: s.number().min(0).max(150),
    profile: s.object({
      bio: s.string(),
      website: s.string().url(),
    }),
    tags: s.array(s.string()),
  },
  indexes: [
    {
      fields: { role: 1, createdAt: -1 },
      options: { name: "idx_role_created" },
    },
  ],
});

const postSchema = schema("posts", {
  timestamps: true,
  fields: {
    title: s.string().required().index({ type: "text" }),
    content: s.string().required(),
    authorId: s.objectId().required().index(),
    status: s.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
    views: s.number().default(0),
  },
});

// ============================================================
// Main Example
// ============================================================

async function main() {
  // Create client - connects immediately in Node.js mode
  const db = await createClient({
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/mondel_example",
    schemas: [userSchema, postSchema] as const,
    syncIndexes: true,
    validation: "strict",
  });

  console.log("Connected to MongoDB");

  try {
    // ========== CREATE ==========
    const createResult = await db.users.create({
      email: "john@example.com",
      name: "John Doe",
      role: "USER",
      age: 30,
      profile: {
        bio: "Software developer",
        website: "https://johndoe.com",
      },
      tags: ["developer", "typescript"],
    });
    console.log("User created:", createResult.insertedId);

    // ========== READ ==========
    const user = await db.users.findOne({ email: "john@example.com" });
    console.log("Found user:", user);

    // ========== UPDATE ==========
    await db.users.updateOne({ email: "john@example.com" }, { $set: { age: 31 } });
    console.log("User updated");

    // ========== CREATE RELATED ==========
    if (user) {
      await db.posts.create({
        title: "My First Post",
        content: "Hello, World!",
        authorId: user._id,
        status: "PUBLISHED",
      });
      console.log("Post created");
    }

    // ========== QUERY WITH OPTIONS ==========
    const posts = await db.posts.findMany(
      { status: "PUBLISHED" },
      { sort: { createdAt: -1 }, limit: 10 }
    );
    console.log("Found posts:", posts.length);

    // ========== AGGREGATION ==========
    const postStats = await db.posts.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    console.log("Post stats:", postStats);

    // ========== UTILITIES ==========
    const userCount = await db.users.count();
    console.log("Total users:", userCount);

    const exists = await db.users.exists({ email: "john@example.com" });
    console.log("User exists:", exists);
  } finally {
    await db.close();
    console.log("Connection closed");
  }
}

main().catch(console.error);
