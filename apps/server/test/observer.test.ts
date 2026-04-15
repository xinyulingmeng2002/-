import { describe, expect, it } from "vitest";

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
    now: () => new Date(Date.UTC(2026, 3, 15, 12, 0, tick++))
  });
}

describe("observer service", () => {
  it("detects repeated questions within a single room", async () => {
    const tempDir = createTempDir();
    const messageService = createMessageService(tempDir);
    const observer = new ObserverService({ messageService });

    try {
      await messageService.appendChatMessage({
        roomId: "room-1",
        speakerParticipantId: "human-1",
        body: "What is the deployment plan?"
      });
      await messageService.appendChatMessage({
        roomId: "room-1",
        speakerParticipantId: "agent-1",
        body: "We should finish uploads first."
      });
      await messageService.appendChatMessage({
        roomId: "room-1",
        speakerParticipantId: "human-1",
        body: "What is the deployment plan?"
      });

      const snapshot = observer.inspectRoom("room-1");

      expect(snapshot.repeatedQuestions).toEqual([
        {
          question: "What is the deployment plan?",
          occurrences: 2,
          speakerParticipantIds: ["human-1"]
        }
      ]);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("surfaces duplicate topic hints from repeated keywords", async () => {
    const tempDir = createTempDir();
    const messageService = createMessageService(tempDir);
    const observer = new ObserverService({ messageService });

    try {
      await messageService.appendChatMessage({
        roomId: "room-2",
        speakerParticipantId: "human-1",
        body: "Deployment checklist should include rollback steps."
      });
      await messageService.appendChatMessage({
        roomId: "room-2",
        speakerParticipantId: "agent-1",
        body: "Deployment owners are still missing."
      });
      await messageService.appendChatMessage({
        roomId: "room-2",
        speakerParticipantId: "human-2",
        body: "Budget can wait until tomorrow."
      });

      const snapshot = observer.inspectRoom("room-2");

      expect(snapshot.duplicateTopicHints).toEqual([
        {
          topic: "deployment",
          occurrences: 2
        }
      ]);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("builds a room summary stub from recent messages", async () => {
    const tempDir = createTempDir();
    const messageService = createMessageService(tempDir);
    const observer = new ObserverService({ messageService });

    try {
      await messageService.appendChatMessage({
        roomId: "room-3",
        speakerParticipantId: "human-1",
        body: "We need a deployment checklist."
      });
      await messageService.appendChatMessage({
        roomId: "room-3",
        speakerParticipantId: "agent-1",
        body: "Rollback steps are still open."
      });
      await messageService.appendChatMessage({
        roomId: "room-3",
        speakerParticipantId: "human-1",
        body: "Please summarize the open work."
      });

      const snapshot = observer.inspectRoom("room-3");

      expect(snapshot.roomSummary).toEqual({
        messageCount: 3,
        participantCount: 2,
        latestMessageAt: "2026-04-15T12:00:02.000Z",
        stub: 'Room room-3 has 3 messages from 2 participants. Latest message: "Please summarize the open work."'
      });
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
