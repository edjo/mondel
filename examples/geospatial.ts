/**
 * Geospatial Queries Example - Mondel ORM
 *
 * This example demonstrates:
 * - 2dsphere geospatial indexes
 * - $geoNear aggregation
 * - $geoWithin queries
 * - Text search indexes
 */
import { schema, s, createClient } from "../src";

// ============================================================
// Schema with Geospatial Index
// ============================================================

const storeSchema = schema("stores", {
  timestamps: true,
  fields: {
    name: s.string().required().index({ type: "text" }),
    address: s.string().required(),
    location: s
      .object({
        type: s.literal("Point"),
        coordinates: s.array(s.number()), // [longitude, latitude]
      })
      .index({ type: "2dsphere", name: "idx_location" }),
    categories: s.array(s.string()),
    rating: s.number().min(0).max(5),
    isOpen: s.boolean().default(true),
  },
});

// ============================================================
// Main Example
// ============================================================

async function main() {
  const db = await createClient({
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/mondel_geo",
    schemas: [storeSchema] as const,
    syncIndexes: true,
  });

  console.log("Connected and indexes created");

  try {
    // Create sample stores
    const stores = [
      {
        name: "Coffee Shop Downtown",
        address: "123 Main St",
        location: { type: "Point" as const, coordinates: [-73.9857, 40.7484] },
        categories: ["coffee", "cafe"],
        rating: 4.5,
      },
      {
        name: "Pizza Palace",
        address: "456 Broadway",
        location: { type: "Point" as const, coordinates: [-73.9879, 40.7489] },
        categories: ["pizza", "italian"],
        rating: 4.2,
      },
      {
        name: "Sushi Express",
        address: "789 5th Ave",
        location: { type: "Point" as const, coordinates: [-73.9772, 40.7614] },
        categories: ["sushi", "japanese"],
        rating: 4.8,
      },
    ];

    await db.stores.createMany(stores);
    console.log("Stores created");

    // ========== $geoNear - Find stores near Times Square ==========
    const nearbyStores = await db.stores.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [-73.9855, 40.758] },
          distanceField: "distance",
          maxDistance: 2000, // 2km radius
          spherical: true,
        },
      },
      { $sort: { distance: 1 } },
    ]);

    console.log("\nStores near Times Square:");
    for (const store of nearbyStores as unknown as Array<{ name: string; distance: number }>) {
      console.log(`- ${store.name}: ${Math.round(store.distance)}m away`);
    }

    // ========== $geoWithin - Using raw MongoDB collection ==========
    const collection = db.stores.getCollection();
    const storesInArea = await collection
      .find({
        location: {
          $geoWithin: {
            $geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-74.0, 40.75],
                  [-73.97, 40.75],
                  [-73.97, 40.77],
                  [-74.0, 40.77],
                  [-74.0, 40.75],
                ],
              ],
            },
          },
        },
      })
      .toArray();

    console.log(`\nStores in defined area: ${storesInArea.length}`);

    // ========== Text Search ==========
    const searchResults = await db.stores.aggregate([
      { $match: { $text: { $search: "coffee" } } },
      { $project: { name: 1, address: 1, score: { $meta: "textScore" } } },
      { $sort: { score: -1 } },
    ]);

    console.log("\nText search results for 'coffee':");
    for (const result of searchResults) {
      console.log(`- ${result.name}`);
    }
  } finally {
    await db.close();
  }
}

main().catch(console.error);
