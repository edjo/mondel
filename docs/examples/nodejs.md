# Node.js Examples

While optimized for serverless, Mondel is fully capable for traditional Node.js servers (Express, Fastify, NestJS).

## Basic Setup

In a long-running process, you typically connect at application startup and reuse the connection.

```typescript
// server.ts
import { createClient } from "mondel";
import { userSchema } from "./schema";

const db = await createClient({
  serverless: false, // important: node mode
  uri: process.env.MONGODB_URI,
  schemas: [userSchema],
});

// Now `db` is fully connected and ready
const app = express();

app.get("/users", async (req, res) => {
  const users = await db.users.findMany({});
  res.json(users);
});
```

Run schema sync separately (deploy step, CI, or local script):

```bash
npx mondel push --uri "$MONGODB_URI" --schema ./dist/schema.js --apply-validators
```

### Express Middleware Pattern

You can attach the database instance to the request object for easy access in routes.

```typescript
// types.d.ts
declare global {
  namespace Express {
    interface Request {
      db: typeof db; // type inference from your client
    }
  }
}

// app.ts
app.use((req, res, next) => {
  req.db = db;
  next();
});
```

## Graceful Shutdown

It is good practice to close the database connection when the Node.js process terminates.

```typescript
process.on("SIGINT", async () => {
  await db.close();
  process.exit(0);
});
```
