import { describe, expect, it } from "vitest";

import { createWorkMemoryStore } from "../src/domain/memory/work-memory-store";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("work memory store", () => {
  it("stores and restores the expanded L0 memory shape", () => {
    const tempDir = createTempDir();
    const store = createWorkMemoryStore(tempDir);

    try {
      store.set("room-1", {
        roomId: "room-1",
        recentMessages: [
          {
            messageId: "msg-1",
            speakerParticipantId: "human-1",
            body: "启动协作",
            timestamp: "2026-04-15T12:00:00.000Z"
          }
        ],
        activeParticipantIds: ["human-1", "agent-1"],
        todoItems: ["实现 event log", "实现 work memory"],
        blockerItems: ["等待协议字段收口"],
        decisionItems: ["先打通消息链路"],
        lastSummaryDraftId: "cand-summary-1",
        updatedAt: "2026-04-15T12:05:00.000Z"
      });

      const reloaded = createWorkMemoryStore(tempDir);
      expect(reloaded.get("room-1")).toEqual({
        roomId: "room-1",
        recentMessages: [
          {
            messageId: "msg-1",
            speakerParticipantId: "human-1",
            body: "启动协作",
            timestamp: "2026-04-15T12:00:00.000Z"
          }
        ],
        activeParticipantIds: ["human-1", "agent-1"],
        todoItems: ["实现 event log", "实现 work memory"],
        blockerItems: ["等待协议字段收口"],
        decisionItems: ["先打通消息链路"],
        lastSummaryDraftId: "cand-summary-1",
        updatedAt: "2026-04-15T12:05:00.000Z"
      });
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
