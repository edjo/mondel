# Serverless Examples

Mondel shines in serverless environments where startup time is critical.

## Cloudflare Workers

In Cloudflare Workers, you use a lightweight client created outside the request handler.

```typescript
// src/db.ts
import { createClient } from "mondel";
import { userSchema, postSchema } from "./schema";

// Create the client factory ONCE (global scope)
// This is very fast and doesn't open a connection yet
export const connect = createClient({
  serverless: true,
  schemas: [userSchema, postSchema],
  validation: "strict",
});
```

Then, use it inside your worker's `fetch` handler.

```typescript
// src/index.ts
import { connect } from "./db";

export default {
  async fetch(request, env, ctx) {
    // 1. Connect using environment variable
    const db = await connect(env.MONGODB_URI);

    // 2. Perform operations
    const users = await db.users.findMany({});

    // 3. Return response
    return Response.json(users);
  },
};
```

## Vercel Edge API Routes

Similar to Cloudflare, establish the connection inside the handler to ensure correct pooling behavior or cleanup.

```typescript
// app/api/users/route.ts
import { NextResponse } from "next/server";
import { connect } from "@/lib/db"; // your createClient export

export async function GET(request: Request) {
  const db = await connect(process.env.MONGODB_URI!);

  const users = await db.users.findMany({
    active: true,
  });

  return NextResponse.json(users);
}
```

### Best Practices

1. **Don't `await` inside global scope**: Serverless platforms discourage or forbid top-level await for side effects like database connections.
2. **Environment Variables**: Always pass the URI from the environment (`env.MONGODB_URI` or `process.env.MONGODB_URI`).
3. **Connection Reuse**: The MongoDB driver (native) handles connection pooling automatically. Mondel simply facilitates access to it.
