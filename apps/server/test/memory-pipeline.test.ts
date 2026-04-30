import { describe, expect, it } from "vitest";

import { createMemoryCandidateStore } from "../src/domain/memory/memory-candidate-store";
import { MemoryPipelineService } from "../src/domain/memory/memory-pipeline-service";
import { createPrivateMemoryStore } from "../src/domain/memory/private-memory-store";
import { createWorkMemoryStore } from "../src/domain/memory/work-memory-store";
import { createEventLogStore } from "../src/domain/messages/event-log-store";
import { MessageService } from "../src/domain/messages/message-service";
import { ObserverService } from "../src/domain/observer/observer-service";
import { cleanupTempDir, createTempDir } from "./helpers";

function createMessageService(dataDir: string) {
  let tick = 0;

  return new MessageService({
    eventLogStore: createEventLogStore(dataDir),
    workMemoryStore: createWorkMemoryStore(dataDir),
    now: () => new Date(Date.UTC(2026, 3, 30, 12, 0, tick++))
  });
}

describe("memory pipeline service", () => {
  it("creates a shared todo candidate from a human message that expresses needed work", async () => {
    const tempDir = createTempDir();
    const messageService = createMessageService(tempDir);
    const pipeline = new MemoryPipelineService({
      observerService: new ObserverService({ messageService }),
      memoryCandidateStore: createMemoryCandidateStore(tempDir),
      privateMemoryStore: createPrivateMemoryStore(tempDir, () => new Date("2026-04-30T12:00:00.000Z")),
      now: () => new Date("2026-04-30T12:00:00.000Z")
    });

    try {
      const event = await messageService.appendChatMessage({
        roomId: "room-1",
        speakerParticipantId: "human-1",
        body: "We need a deployment checklist before rollout."
      });

      const result = pipeline.processEvent(event);

      expect(result.candidates).toEqual([
        expect.objectContaining({
          roomId: "room-1",
          scope: "shared",
          candidateType: "todo",
          proposedBy: "observer",
          sourceEventIds: [event.eventId]
        })
      ]);
      expect(result.privateMemories).toEqual([]);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("creates a private memory for an agent message that explicitly asks to remember something", async () => {
    const tempDir = createTempDir();
    const messageService = createMessageService(tempDir);
    const privateMemoryStore = createPrivateMemoryStore(
      tempDir,
      () => new Date("2026-04-30T12:00:01.000Z")
    );
    const pipeline = new MemoryPipelineService({
      observerService: new ObserverService({ messageService }),
      memoryCandidateStore: createMemoryCandidateStore(tempDir),
      privateMemoryStore,
      now: () => new Date("2026-04-30T12:00:01.000Z")
    });

    try {
      const event = await messageService.appendChatMessage({
        roomId: "room-2",
        speakerParticipantId: "agent-codex",
        body: "Remember: route future bridge notes through candidate review."
      });

      const result = pipeline.processEvent(event);

      expect(result.candidates).toEqual([]);
      expect(result.privateMemories).toEqual([
        expect.objectContaining({
          agentId: "agent-codex",
          roomId: "room-2",
          memoryType: "insight",
          visibility: "private",
          sourceEventIds: [event.eventId]
        })
      ]);
      expect(privateMemoryStore.list({ agentId: "agent-codex", roomId: "room-2" })).toEqual([
        expect.objectContaining({
          agentId: "agent-codex",
          roomId: "room-2"
        })
      ]);
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
