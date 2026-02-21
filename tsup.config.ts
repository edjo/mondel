import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: false,
    treeshake: true,
    external: ["mongodb", "zod", "typescript"],
  },
  {
    entry: ["src/cli/index.ts"],
    format: ["cjs"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    minify: false,
    treeshake: true,
    external: ["mongodb", "zod", "typescript"],
    outDir: "dist/cli",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
