import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const configDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    name: "@ma/bridge-generic",
    include: [resolve(configDir, "test/**/*.test.ts")],
    passWithNoTests: false
  }
});
