import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("participants api", () => {
  it("returns the persisted participant list across server restarts", async () => {
    const tempDir = createTempDir();
    const dbDir = join(tempDir, "data", "db");
    const participants = [
      {
        id: "participant-agent-codex",
        type: "agent",
        displayName: "Codex",
        bridgeKind: "codex",
        capabilities: ["chat"],
        createdAt: "2026-04-15T00:00:00.000Z",
        lastSeenAt: "2026-04-15T00:01:00.000Z"
      },
      {
        id: "participant-human-1",
        type: "human",
        displayName: "Alice",
        bridgeKind: null,
        capabilities: [],
        createdAt: "2026-04-15T00:00:00.000Z",
        lastSeenAt: "2026-04-15T00:02:00.000Z"
      }
    ];

    mkdirSync(dbDir, { recursive: true });
    writeFileSync(join(dbDir, "participants.json"), JSON.stringify({ items: participants }, null, 2), "utf8");

    const firstApp = buildServer({ dataDir: tempDir });

    try {
      const firstResponse = await firstApp.inject({ method: "GET", url: "/api/participants" });

      expect(firstResponse.statusCode).toBe(200);
      expect(firstResponse.json()).toEqual({ items: participants });
    } finally {
      await firstApp.close();
    }

    const secondApp = buildServer({ dataDir: tempDir });

    try {
      const secondResponse = await secondApp.inject({ method: "GET", url: "/api/participants" });

      expect(secondResponse.statusCode).toBe(200);
      expect(secondResponse.json()).toEqual({ items: participants });
    } finally {
      await secondApp.close();
      cleanupTempDir(tempDir);
    }
  });
});
