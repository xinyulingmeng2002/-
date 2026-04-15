import { randomUUID } from "node:crypto";

import type { WorkMemoryRecord, WorkMemoryStore } from "../memory/work-memory-store";
import type { EventLogStore, RoomEventRecord } from "./event-log-store";

export interface AppendChatMessageInput {
  roomId: string;
  speakerParticipantId: string;
  body: string;
}

type MessageServiceOptions = {
  eventLogStore: EventLogStore;
  workMemoryStore: WorkMemoryStore;
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
  private readonly now: () => Date;

  constructor(options: MessageServiceOptions) {
    this.eventLogStore = options.eventLogStore;
    this.workMemoryStore = options.workMemoryStore;
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

    this.workMemoryStore.set(input.roomId, {
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
    });

    return event;
  }

  listRoomEvents(roomId: string): RoomEventRecord[] {
    return this.eventLogStore.list(roomId);
  }
}
