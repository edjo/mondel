import { createClient, defineSchema, s, type SchemasToClient } from "../../src";

const userSchema = defineSchema("users", {
  timestamps: true,
  fields: {
    email: s.string().email().required(),
    role: s.enum(["ADMIN", "USER"]).default("USER"),
  },
});

const schemas = [userSchema] as const;
type DbClient = SchemasToClient<typeof schemas>;

const connectDb = createClient({
  serverless: true,
  schemas,
  validation: "strict",
});

declare const mongoUri: string;

async function run(): Promise<DbClient> {
  const db = await connectDb(mongoUri);
  await db.users.findMany({ role: "USER" });
  return db;
}

void run;
