# Geospatial Queries

MongoDB provides powerful geospatial query capabilities. This guide shows how to use them with Mondel.

## Schema Setup

Define a schema with a geospatial index:

```typescript
import { defineSchema, s, createClient } from "mondel";

const storeSchema = defineSchema("stores", {
  timestamps: true,
  fields: {
    name: s.string().required(),
    address: s.string().required(),
    // GeoJSON Point format
    location: s.object({
      type: s.literal("Point"),
      coordinates: s.array(s.number()), // [longitude, latitude]
    }).index({ type: "2dsphere", name: "idx_location" }),
    categories: s.array(s.string()),
    rating: s.number().min(0).max(5),
  },
});
```

## Creating Geospatial Data

```typescript
const db = await createClient({
  uri: process.env.MONGODB_URI,
  schemas: [storeSchema] as const,
});

// Create stores with coordinates [longitude, latitude]
await db.stores.createMany([
  {
    name: "Coffee Shop Downtown",
    address: "123 Main St",
    location: { type: "Point", coordinates: [-73.9857, 40.7484] },
    categories: ["coffee", "cafe"],
    rating: 4.5,
  },
  {
    name: "Pizza Palace",
    address: "456 Broadway",
    location: { type: "Point", coordinates: [-73.9879, 40.7489] },
    categories: ["pizza", "italian"],
    rating: 4.2,
  },
]);
```

Then sync indexes once:

```bash
npx mondel push --uri "$MONGODB_URI" --schema ./dist/store-schema.js
```

::: warning Coordinate Order
MongoDB uses **[longitude, latitude]** order, not [latitude, longitude]. This is a common source of bugs!
:::

## Finding Nearby Locations

### Using $geoNear Aggregation

The most powerful way to find nearby locations with distance calculation:

```typescript
const nearbyStores = await db.stores.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [-73.9855, 40.758] }, // Times Square
      distanceField: "distance", // Adds distance in meters
      maxDistance: 2000,         // 2km radius
      spherical: true,
    },
  },
  { $sort: { distance: 1 } },
  { $limit: 10 },
]);

// Results include distance field
for (const store of nearbyStores) {
  console.log(`${store.name}: ${Math.round(store.distance)}m away`);
}
```

### Using $near Query

For simpler queries without distance calculation:

```typescript
const collection = db.stores.getCollection();

const nearbyStores = await collection.find({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [-73.9855, 40.758] },
      $maxDistance: 2000, // meters
    },
  },
}).toArray();
```

## Finding Within Area

### Circle ($centerSphere)

Find all locations within a circular area:

```typescript
const EARTH_RADIUS_KM = 6371;
const radiusKm = 5;

const storesInRadius = await db.stores.aggregate([
  {
    $match: {
      location: {
        $geoWithin: {
          $centerSphere: [
            [-73.9855, 40.758], // center point
            radiusKm / EARTH_RADIUS_KM, // radius in radians
          ],
        },
      },
    },
  },
]);
```

### Polygon ($geoWithin)

Find locations within a specific area:

```typescript
const collection = db.stores.getCollection();

const storesInArea = await collection.find({
  location: {
    $geoWithin: {
      $geometry: {
        type: "Polygon",
        coordinates: [[
          [-74.0, 40.75],    // Southwest
          [-73.97, 40.75],   // Southeast
          [-73.97, 40.77],   // Northeast
          [-74.0, 40.77],    // Northwest
          [-74.0, 40.75],    // Close the polygon
        ]],
      },
    },
  },
}).toArray();
```

## Text Search with Location

Combine text search with geospatial queries:

```typescript
const storeSchema = defineSchema("stores", {
  fields: {
    name: s.string().required().index({ type: "text" }),
    description: s.string().index({ type: "text" }),
    location: s.object({
      type: s.literal("Point"),
      coordinates: s.array(s.number()),
    }).index({ type: "2dsphere" }),
  },
});

// Search for "coffee" near a location
const results = await db.stores.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [-73.9855, 40.758] },
      distanceField: "distance",
      maxDistance: 5000,
      spherical: true,
      query: { $text: { $search: "coffee" } }, // Text filter
    },
  },
  { $limit: 20 },
]);
```

## Delivery Zone Example

Check if a delivery address is within service area:

```typescript
const zoneSchema = defineSchema("deliveryZones", {
  fields: {
    name: s.string().required(),
    area: s.object({
      type: s.literal("Polygon"),
      coordinates: s.array(s.array(s.array(s.number()))),
    }).index({ type: "2dsphere" }),
    deliveryFee: s.number(),
  },
});

// Check which zone covers an address
async function getDeliveryZone(coordinates: [number, number]) {
  const collection = db.deliveryZones.getCollection();
  
  const zone = await collection.findOne({
    area: {
      $geoIntersects: {
        $geometry: { type: "Point", coordinates },
      },
    },
  });
  
  return zone;
}

// Usage
const zone = await getDeliveryZone([-73.9857, 40.7484]);
if (zone) {
  console.log(`Delivery fee: $${zone.deliveryFee}`);
} else {
  console.log("Sorry, we don't deliver to this area");
}
```

## Performance Tips

1. **Always use 2dsphere indexes** for Earth-surface calculations
2. **Use $geoNear as the first stage** in aggregation pipelines
3. **Set reasonable maxDistance** to limit results
4. **Combine with other filters** in the query parameter of $geoNear
5. **Use $geoWithin for known areas** (faster than $near for bounded queries)
