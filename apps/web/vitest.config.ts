import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const configDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    name: "@ma/web",
    include: [resolve(configDir, "src/test/**/*.test.tsx")],
    environment: "jsdom",
    globals: true,
    setupFiles: [resolve(configDir, "src/test/setup.ts")]
  }
});
