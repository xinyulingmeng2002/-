import { describe, expect, it } from "vitest";

import { createWorkMemoryStore } from "../src/domain/memory/work-memory-store";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("work memory store", () => {
  it("stores and restores the minimal L0 memory shape", () => {
    const tempDir = createTempDir();
    const store = createWorkMemoryStore(tempDir);

    try {
      store.set("room-1", {
        recentMessages: [
          {
            messageId: "msg-1",
            speakerParticipantId: "human-1",
            body: "启动协作",
            timestamp: "2026-04-15T12:00:00.000Z"
          }
        ],
        activeParticipantIds: ["human-1", "agent-1"],
        lastDecisionSummary: "先打通消息链路",
        todoItems: ["实现 event log", "实现 work memory"]
      });

      const reloaded = createWorkMemoryStore(tempDir);
      expect(reloaded.get("room-1")).toEqual({
        recentMessages: [
          {
            messageId: "msg-1",
            speakerParticipantId: "human-1",
            body: "启动协作",
            timestamp: "2026-04-15T12:00:00.000Z"
          }
        ],
        activeParticipantIds: ["human-1", "agent-1"],
        lastDecisionSummary: "先打通消息链路",
        todoItems: ["实现 event log", "实现 work memory"]
      });
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
