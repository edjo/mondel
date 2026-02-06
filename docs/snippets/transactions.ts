import { createClient, defineSchema, s } from "../../src";

const accountSchema = defineSchema("accounts", {
  timestamps: true,
  fields: {
    ownerId: s.objectId().required(),
    balance: s.number().min(0).required(),
  },
});

async function transfer(uri: string, fromId: string, toId: string, amount: number): Promise<void> {
  const db = await createClient({
    uri,
    schemas: [accountSchema] as const,
    validation: "strict",
  });

  const session = db.startSession();

  try {
    await session.withTransaction(async () => {
      await db.accounts.updateById(fromId, { $inc: { balance: -amount } }, { session });
      await db.accounts.updateById(toId, { $inc: { balance: amount } }, { session });
    });
  } finally {
    await session.endSession();
    await db.close();
  }
}

void transfer;
