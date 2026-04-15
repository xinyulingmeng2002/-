import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("rooms api", () => {
  it("creates a room and lists it back", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const create = await app.inject({
        method: "POST",
        url: "/api/rooms",
        payload: { spaceId: "space-default", name: "主协作间" }
      });

      expect(create.statusCode).toBe(201);

      const list = await app.inject({ method: "GET", url: "/api/rooms?spaceId=space-default" });
      expect(list.json().items).toHaveLength(1);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
