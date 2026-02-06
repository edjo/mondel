import { defineSchema, s, zodCreateSchema } from "../../src";

const productSchema = defineSchema("products", {
  fields: {
    sku: s.string().min(3).required(),
    price: s.number().min(0).required(),
    status: s.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
  },
});

const createProduct = zodCreateSchema(productSchema);

const result = createProduct.safeParse({
  sku: "SKU-123",
  price: 19.99,
});

if (!result.success) {
  throw result.error;
}
