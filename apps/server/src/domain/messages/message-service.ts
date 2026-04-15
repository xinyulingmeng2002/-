import { randomUUID } from "node:crypto";

import type { RoomSummaryStore } from "../memory/room-summary-store";
import type { WorkMemoryMessage, WorkMemoryRecord, WorkMemoryStore } from "../memory/work-memory-store";
import type { EventLogStore, RoomEventRecord } from "./event-log-store";

export interface AppendChatMessageInput {
  roomId: string;
  speakerParticipantId: string;
  body: string;
}

type MessageServiceOptions = {
  eventLogStore: EventLogStore;
  workMemoryStore: WorkMemoryStore;
  roomSummaryStore?: RoomSummaryStore;
  now?: () => Date;
};

function defaultWorkMemory(): WorkMemoryRecord {
  return {
    recentMessages: [],
    activeParticipantIds: [],
    lastDecisionSummary: "",
    todoItems: []
  };
}

export class MessageService {
  private readonly eventLogStore: EventLogStore;
  private readonly workMemoryStore: WorkMemoryStore;
  private readonly roomSummaryStore?: RoomSummaryStore;
  private readonly now: () => Date;

  constructor(options: MessageServiceOptions) {
    this.eventLogStore = options.eventLogStore;
    this.workMemoryStore = options.workMemoryStore;
    this.roomSummaryStore = options.roomSummaryStore;
    this.now = options.now ?? (() => new Date());
  }

  async appendChatMessage(input: AppendChatMessageInput): Promise<RoomEventRecord> {
    const timestamp = this.now().toISOString();
    const messageId = `msg_${randomUUID()}`;
    const event: RoomEventRecord = {
      eventId: `evt_${randomUUID()}`,
      kind: "message.created",
      roomId: input.roomId,
      timestamp,
      payload: {
        messageId,
        speakerParticipantId: input.speakerParticipantId,
        body: input.body
      }
    };

    this.eventLogStore.append(event);

    const current = this.workMemoryStore.get(input.roomId) ?? defaultWorkMemory();
    const activeParticipantIds = current.activeParticipantIds.includes(input.speakerParticipantId)
      ? current.activeParticipantIds
      : [...current.activeParticipantIds, input.speakerParticipantId];

    const nextMemory = {
      ...current,
      activeParticipantIds,
      recentMessages: [
        ...current.recentMessages,
        {
          messageId,
          speakerParticipantId: input.speakerParticipantId,
          body: input.body,
          timestamp
        }
      ]
    };

    this.workMemoryStore.set(input.roomId, nextMemory);

    if (this.roomSummaryStore && nextMemory.recentMessages.length % 2 === 0) {
      const latestMessage = nextMemory.recentMessages.at(-1);
      const firstMessage = nextMemory.recentMessages[0];

      if (latestMessage && firstMessage) {
        this.roomSummaryStore.append({
          roomId: input.roomId,
          generatedAt: timestamp,
          messageCount: nextMemory.recentMessages.length,
          participantCount: nextMemory.activeParticipantIds.length,
          summaryText: `Room ${input.roomId} has ${nextMemory.recentMessages.length} messages from ${nextMemory.activeParticipantIds.length} participants. Latest message: "${latestMessage.body}"`,
          sourceEventRange: {
            firstMessageId: firstMessage.messageId,
            lastMessageId: latestMessage.messageId
          }
        });
      }
    }

    return event;
  }

  listRoomEvents(roomId: string): RoomEventRecord[] {
    return this.eventLogStore.list(roomId);
  }

  listRoomEventsAfter(
    roomId: string,
    options: {
      afterEventId?: string;
      limit?: number;
    } = {}
  ): RoomEventRecord[] {
    const events = this.eventLogStore.list(roomId);
    const fallbackLimit = events.length > 0 ? events.length : 1;
    const limit = Math.max(1, options.limit ?? fallbackLimit);

    if (options.afterEventId) {
      const index = events.findIndex((event) => event.eventId === options.afterEventId);
      if (index < 0) {
        return [];
      }

      return events.slice(index + 1, index + 1 + limit);
    }

    return events.length > limit ? events.slice(-limit) : events;
  }

  listRoomMessages(roomId: string): WorkMemoryMessage[] {
    return [...(this.workMemoryStore.get(roomId)?.recentMessages ?? [])];
  }
}
