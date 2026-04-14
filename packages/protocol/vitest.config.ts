import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@ma/protocol",
    include: ["packages/protocol/test/**/*.test.ts"],
    passWithNoTests: false
  }
});
