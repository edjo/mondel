/**
 * Multiple Databases Example - Mondel ORM
 *
 * This example demonstrates connecting to multiple MongoDB databases
 * simultaneously, each with their own schemas.
 */
import { schema, s, createClient } from "../src";

// ============================================================
// Schema Definitions for Different Databases
// ============================================================

const userSchema = schema("users", {
  timestamps: true,
  fields: {
    email: s.string().required().unique(),
    name: s.string(),
  },
});

const eventSchema = schema("events", {
  timestamps: true,
  fields: {
    type: s.string().required().index(),
    userId: s.string().required().index(),
    data: s.json(),
  },
});

// ============================================================
// Main Example
// ============================================================

async function main() {
  // Create separate clients for each database
  const mainDb = await createClient({
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/main_db",
    schemas: [userSchema] as const,
    syncIndexes: true,
  });

  const analyticsDb = await createClient({
    uri: process.env.ANALYTICS_URI || "mongodb://localhost:27017/analytics_db",
    schemas: [eventSchema] as const,
    syncIndexes: true,
  });

  console.log("Both databases connected");

  try {
    // Use main database for users
    const user = await mainDb.users.create({
      email: "test@example.com",
      name: "Test User",
    });
    console.log("User created in main DB:", user.insertedId);

    // Use analytics database for events
    await analyticsDb.events.create({
      type: "user_signup",
      userId: user.insertedId.toString(),
      data: { source: "web" },
    });
    console.log("Event logged in analytics DB");

    // Query from different databases
    const users = await mainDb.users.findMany();
    const events = await analyticsDb.events.findMany({ type: "user_signup" });

    console.log("Users count:", users.length);
    console.log("Events count:", events.length);
  } finally {
    await mainDb.close();
    await analyticsDb.close();
    console.log("All connections closed");
  }
}

main().catch(console.error);
