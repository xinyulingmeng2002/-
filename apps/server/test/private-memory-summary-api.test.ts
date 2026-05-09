import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("private memory summary api", () => {
  it("returns redacted private memory overview grouped by agent", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/private-memories",
        payload: {
          agentId: "agent-codex",
          roomId: "room-1",
          memoryType: "insight",
          title: "Internal bridge note",
          body: "Route this through candidate review after triage.",
          tags: ["bridge", "review"],
          confidence: 0.9,
          sourceEventIds: ["evt-1"]
        }
      });

      expect(created.statusCode).toBe(201);

      const response = await app.inject({
        method: "GET",
        url: "/api/private-memories/summary?roomId=room-1"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [
          expect.objectContaining({
            agentId: "agent-codex",
            roomId: "room-1",
            totalMemories: 1,
            shareableMemories: 1
          })
        ]
      });
      expect(response.json().items[0]).not.toHaveProperty("title");
      expect(response.json().items[0]).not.toHaveProperty("body");
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
