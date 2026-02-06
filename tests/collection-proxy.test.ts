import { ObjectId, type ClientSession, type Db, type Document } from "mongodb";
import { ZodError } from "zod";
import { describe, expect, it, vi, afterEach } from "vitest";
import { CollectionProxy } from "../src/manager/collection-proxy";
import type { Schema } from "../src/types";

function makeSchema(): Schema {
  return {
    name: "users",
    collection: "users",
    timestamps: false,
    validation: { enabled: true, mode: "strict" },
    fields: {
      email: {
        type: "string",
        required: true,
        unique: false,
      },
    },
    indexes: [],
  };
}

function makeProxy(validationMode: "strict" | "loose" | "off" = "strict") {
  const cursor = {
    project: vi.fn(),
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
    toArray: vi.fn().mockResolvedValue([]),
  };
  cursor.project.mockReturnValue(cursor);
  cursor.sort.mockReturnValue(cursor);
  cursor.skip.mockReturnValue(cursor);
  cursor.limit.mockReturnValue(cursor);

  const collection = {
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockReturnValue(cursor),
    insertOne: vi.fn().mockResolvedValue({ insertedId: new ObjectId() }),
    insertMany: vi.fn().mockResolvedValue({ insertedCount: 0, insertedIds: {} }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 0, modifiedCount: 0 }),
    updateMany: vi.fn().mockResolvedValue({ matchedCount: 0, modifiedCount: 0 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    countDocuments: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
  };

  const db = {
    collection: vi.fn().mockReturnValue(collection),
  } as unknown as Db;

  const proxy = new CollectionProxy(db, makeSchema(), validationMode);
  return { proxy, collection, cursor };
}

describe("CollectionProxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards session in findOne options", async () => {
    const { proxy, collection } = makeProxy();
    const session = { id: "s1" } as unknown as ClientSession;

    await proxy.findOne({ email: "user@example.com" } as Document, {
      session,
    });

    expect(collection.findOne).toHaveBeenCalledWith(
      { email: "user@example.com" },
      expect.objectContaining({ session })
    );
  });

  it("forwards session in findMany options", async () => {
    const { proxy, collection } = makeProxy();
    const session = { id: "s2" } as unknown as ClientSession;

    await proxy.findMany({}, { session });

    expect(collection.find).toHaveBeenCalledWith({}, expect.objectContaining({ session }));
  });

  it("forwards insert options (including session) in create", async () => {
    const { proxy, collection } = makeProxy();
    const session = { id: "s3" } as unknown as ClientSession;

    await proxy.create({ email: "user@example.com" }, { session });

    expect(collection.insertOne).toHaveBeenCalledWith(
      { email: "user@example.com" },
      expect.objectContaining({ session })
    );
  });

  it("throws ZodError in strict mode on invalid create input", async () => {
    const { proxy } = makeProxy("strict");

    await expect(proxy.create({ email: 123 } as unknown as Document)).rejects.toBeInstanceOf(
      ZodError
    );
  });

  it("warns and proceeds in loose mode on invalid create input", async () => {
    const { proxy, collection } = makeProxy("loose");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await proxy.create({ email: 123 } as unknown as Document);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(collection.insertOne).toHaveBeenCalledOnce();
  });
});
