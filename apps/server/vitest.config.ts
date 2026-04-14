import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@ma/server",
    passWithNoTests: true
  }
});
