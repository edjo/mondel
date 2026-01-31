import type { SchemasToManager, Schema } from "./src";

// Simular um schema
declare const testSchema: Schema & { readonly __name: "users" };
declare const schemas: readonly [typeof testSchema];

// O tipo do manager
type TestManager = SchemasToManager<typeof schemas>;

declare const manager: TestManager;

// Isso deve funcionar
manager.users;

// Isso NÃO deve funcionar - deve dar erro de tipo
manager.tables;
manager.foo;
