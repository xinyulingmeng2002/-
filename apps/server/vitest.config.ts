import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@ma/server",
    include: ["apps/server/test/**/*.test.ts"],
    passWithNoTests: false
  }
});
