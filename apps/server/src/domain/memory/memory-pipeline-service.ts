import { randomUUID } from "node:crypto";

import type { MemoryCandidateRecord, MemoryCandidateStore } from "./memory-candidate-store";
import type { PrivateMemoryRecord, PrivateMemoryStore } from "./private-memory-store";
import type { RoomEventRecord } from "../messages/event-log-store";
import type { ObserverService } from "../observer/observer-service";

type MemoryPipelineServiceOptions = {
  observerService: ObserverService;
  memoryCandidateStore: MemoryCandidateStore;
  privateMemoryStore: PrivateMemoryStore;
  now?: () => Date;
};

const PRIVATE_MEMORY_PATTERNS = [/^remember[:\s]/i, /^记住[:：]/];

export class MemoryPipelineService {
  private readonly observerService: ObserverService;
  private readonly memoryCandidateStore: MemoryCandidateStore;
  private readonly privateMemoryStore: PrivateMemoryStore;
  private readonly now: () => Date;

  constructor(options: MemoryPipelineServiceOptions) {
    this.observerService = options.observerService;
    this.memoryCandidateStore = options.memoryCandidateStore;
    this.privateMemoryStore = options.privateMemoryStore;
    this.now = options.now ?? (() => new Date());
  }

  processEvent(event: RoomEventRecord): {
    candidates: MemoryCandidateRecord[];
    privateMemories: PrivateMemoryRecord[];
  } {
    if (event.kind !== "message.created") {
      return { candidates: [], privateMemories: [] };
    }

    const candidates = this.observerService.suggestCandidates(event.roomId).map((suggestion) =>
      this.memoryCandidateStore.create({
        candidateId: `cand_${randomUUID()}`,
        roomId: event.roomId,
        scope: "shared",
        candidateType: suggestion.candidateType,
        title: suggestion.title,
        body: suggestion.body,
        status: "proposed",
        proposedBy: "observer",
        sourceEventIds: [event.eventId],
        sourceMemoryIds: [],
        targetAgentId: null,
        createdAt: this.timestamp(),
        reviewedAt: null,
        reviewedBy: null,
        acceptedInto: []
      })
    );

    const privateMemories = this.buildPrivateMemories(event);

    return {
      candidates,
      privateMemories
    };
  }

  private buildPrivateMemories(event: RoomEventRecord): PrivateMemoryRecord[] {
    if (event.source !== "agent") {
      return [];
    }

    const body = event.payload.body;
    if (typeof body !== "string" || !PRIVATE_MEMORY_PATTERNS.some((pattern) => pattern.test(body))) {
      return [];
    }

    return [
      this.privateMemoryStore.create({
        agentId: event.actorParticipantId,
        roomId: event.roomId,
        memoryType: "insight",
        title: body.slice(0, 80),
        body,
        tags: ["observer-derived"],
        confidence: 0.8,
        sourceEventIds: [event.eventId]
      })
    ];
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}
