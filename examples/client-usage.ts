import { schema, s, createClient } from "../src";

// Define schemas - these would normally be in src/db/schema.ts
// Note: _id is automatically created by MongoDB, no need to define it
// collection defaults to the schema name if not specified
export const userSchema = schema("users", {
  timestamps: true,
  fields: {
    email: s.string().required().unique(),
    name: s.string(),
    role: s.enum(["ADMIN", "USER", "GUEST"]).default("USER"),
  },
});

export const postSchema = schema("posts", {
  timestamps: true,
  fields: {
    title: s.string().required(),
    content: s.string().required(),
    authorId: s.objectId().required(),
  },
});

// ============================================================
// OPTION 1: Node.js mode (traditional server)
// ============================================================
async function nodeJsExample() {
  // URI is required, connects immediately
  const db = await createClient({
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/mydb",
    schemas: [userSchema, postSchema],
    syncIndexes: false,
    validation: "strict",
  });

  try {
    // Type-safe operations
    const user = await db.users.create({
      email: "john@example.com",
      name: "John Doe",
    });
    console.log("Created user:", user.insertedId);

    await db.posts.create({
      title: "Hello World",
      content: "My first post",
      authorId: user.insertedId,
    });

    const users = await db.users.findMany();
    console.log("Users:", users.length);
  } finally {
    await db.close();
  }
}

// ============================================================
// OPTION 2: Serverless mode (Cloudflare Workers, Vercel Edge, etc.)
// ============================================================
export async function serverlessExample() {
  const { createClient } = await import("../src");

  // Returns a factory function - no connection yet
  const connectDb = createClient({
    serverless: true,
    schemas: [userSchema, postSchema],
    syncIndexes: false, // Usually false for serverless (indexes created separately)
    validation: "strict",
  });

  // In your request handler:
  async function handleRequest(_request: Request) {
    // Connect per-request (connection pooling handled by MongoDB driver)
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/mydb";
    const db = await connectDb(uri);

    try {
      const users = await db.users.findMany();
      return new Response(JSON.stringify(users));
    } finally {
      await db.close();
    }
  }

  // Simulate a request
  await handleRequest(new Request("https://example.com"));
}

// ============================================================
// OPTION 3: Load all schemas from a directory
// ============================================================
export async function directoryExample() {
  const { createClient } = await import("../src");

  // Load all schemas from ./src/db/schema/ directory
  const db = await createClient({
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/mydb",
    schemas: [userSchema, postSchema], // Directory with schema files
  });

  // All schemas in the directory are available
  // db.users, db.posts, db.products, etc.

  await db.close();
}

// ============================================================
// OPTION 4: Robust Timestamps with Operators
// ============================================================
export async function robustTimestampsExample() {
  const { createClient } = await import("../src"); // Dynamic import for example context

  const db = await createClient({
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/mydb",
    schemas: [userSchema],
    syncIndexes: false,
    validation: "strict",
  });

  try {
    const user = await db.users.create({
      email: "timestamp@test.com",
      name: "Original Name",
    });
    console.log("Original:", user.insertedId);

    // 1. Update with operators (should update updatedAt automatically)
    await db.users.updateOne({ _id: user.insertedId }, { $set: { name: "Updated Name" } });

    // 2. Upsert with operators (should set createdAt automatically)
    await db.users.updateOne(
      { email: "upsert-operator@test.com" },
      { $set: { name: "Upserted User" } },
      { upsert: true }
    );
    console.log("Upserted user with automatic createdAt");
  } finally {
    await db.close();
  }
}

// Run the Node.js example
nodeJsExample().catch(console.error);
// robustTimestampsExample().catch(console.error);
