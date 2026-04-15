import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    name: "@ma/web",
    environment: "jsdom",
    globals: true,
    setupFiles: ["apps/web/src/test/setup.ts"]
  }
});
