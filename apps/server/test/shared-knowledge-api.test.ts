import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("shared knowledge api", () => {
  it("lists shared knowledge records by room", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/shared-knowledge?roomId=room-1"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ items: [] });
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
