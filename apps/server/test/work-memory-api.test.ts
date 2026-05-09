import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { createWorkMemoryStore } from "../src/domain/memory/work-memory-store";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("work memory api", () => {
  it("returns the current room work memory snapshot", async () => {
    const tempDir = createTempDir();
    const store = createWorkMemoryStore(tempDir);
    const app = buildServer({ dataDir: tempDir });

    store.set("room-1", {
      roomId: "room-1",
      recentMessages: [],
      activeParticipantIds: ["human-1"],
      todoItems: ["补工作记忆面板"],
      blockerItems: ["等待审核反馈"],
      decisionItems: ["先做共享层 UI"],
      lastSummaryDraftId: "cand-summary-1",
      updatedAt: "2026-04-30T12:00:00.000Z"
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/work-memory?roomId=room-1"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        roomId: "room-1",
        recentMessages: [],
        activeParticipantIds: ["human-1"],
        todoItems: ["补工作记忆面板"],
        blockerItems: ["等待审核反馈"],
        decisionItems: ["先做共享层 UI"],
        lastSummaryDraftId: "cand-summary-1",
        updatedAt: "2026-04-30T12:00:00.000Z"
      });
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
