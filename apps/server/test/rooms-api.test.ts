import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

  it("restores space-default when spaces snapshot misses it", async () => {
    const tempDir = createTempDir();
    const dbDir = join(tempDir, "data", "db");
    mkdirSync(dbDir, { recursive: true });
    writeFileSync(join(dbDir, "spaces.json"), JSON.stringify({ items: [] }, null, 2), "utf8");

    const app = buildServer({ dataDir: tempDir });

    try {
      const response = await app.inject({ method: "GET", url: "/api/spaces" });
      expect(response.statusCode).toBe(200);
      expect(response.json().items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "space-default" })])
      );
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("returns diagnosable 500 when rooms snapshot is corrupted", async () => {
    const tempDir = createTempDir();
    const dbDir = join(tempDir, "data", "db");
    mkdirSync(dbDir, { recursive: true });
    writeFileSync(join(dbDir, "rooms.json"), "{broken", "utf8");

    const app = buildServer({ dataDir: tempDir });

    try {
      const response = await app.inject({ method: "GET", url: "/api/rooms?spaceId=space-default" });
      expect(response.statusCode).toBe(500);
      expect(response.json().message).toContain("rooms.json");
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
