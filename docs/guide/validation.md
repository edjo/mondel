# Validation

Mondel uses Zod under the hood to perform rigorous runtime validation. This ensures the data entering your database strictly adheres to your TypeScript definitions.

## Zod Integration

Every schema definition you create with `defineSchema` is compiled into a Zod schema internally. When you perform `create` or `update` operations, Mondel automatically validates the input against this schema.

### Runtime vs Compile-Time

- **Compile-Time**: TypeScript catches most errors before you run your code. E.g., passing a string where a number is expected.
- **Runtime**: Zod catches data that is dynamically invalid. E.g., an email string that doesn't actually look like an email.

### Validation Modes

You can control how strict Mondel should be when validating data. This is configured when creating the client.

```typescript
const client = createClient({
  schemas: [users],

  // "strict" | "loose" | "off"
  validation: "strict",
});
```

- **`strict` (Default)**: Throws a `ZodError` immediately if validation fails. This guarantees 100% data integrity but has a slight performance cost.
- **`loose`**: Logs a warning to the console if validation fails, but proceeds with the operation. Useful for gradual migrations or development.
- **`off`**: Disables runtime validation completely. rely solely on TypeScript. Good for maximum performance in trusted environments.

## Performance Considerations

Validation adds a small overhead to write operations. Read operations (`find`, `findOne`) generally do **not** undergo validation, assuming the data in the database is already correct. This keeps read performance extremely high.

If you need to validate data coming _out_ of the database (e.g., from a legacy system), you can manually use the schema's Zod validator, though this is rarely needed in a greenfield Mondel application.
