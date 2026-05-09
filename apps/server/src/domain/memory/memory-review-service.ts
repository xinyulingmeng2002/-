import { randomUUID } from "node:crypto";

import type { EventLogStore, RoomEventRecord } from "../messages/event-log-store";
import type {
  MemoryCandidateRecord,
  MemoryCandidateStore,
  MemoryCandidateType
} from "./memory-candidate-store";
import type { PrivateMemoryStore } from "./private-memory-store";
import type { SharedKnowledgeKind, SharedKnowledgeStore } from "./shared-knowledge-store";
import { createEmptyWorkMemory, type WorkMemoryRecord, type WorkMemoryStore } from "./work-memory-store";

type MemoryReviewServiceOptions = {
  memoryCandidateStore: MemoryCandidateStore;
  privateMemoryStore: PrivateMemoryStore;
  sharedKnowledgeStore: SharedKnowledgeStore;
  workMemoryStore: WorkMemoryStore;
  eventLogStore: EventLogStore;
  now?: () => Date;
};

type ReviewCandidateInput = {
  candidateId: string;
  reviewedBy: string;
};

type SharePrivateMemoryInput = {
  memoryId: string;
  agentId: string;
  candidateType: MemoryCandidateType;
};

function inferEventSource(participantId: string): RoomEventRecord["source"] {
  if (participantId === "system") {
    return "system";
  }
  if (participantId.startsWith("agent-")) {
    return "agent";
  }

  return "human";
}

function mapCandidateTypeToKnowledgeKind(candidateType: MemoryCandidateType): SharedKnowledgeKind {
  switch (candidateType) {
    case "decision":
      return "decision";
    case "todo":
      return "todo";
    case "blocker":
      return "constraint";
    case "summary":
      return "fact";
  }
}

export class MemoryReviewService {
  private readonly memoryCandidateStore: MemoryCandidateStore;
  private readonly privateMemoryStore: PrivateMemoryStore;
  private readonly sharedKnowledgeStore: SharedKnowledgeStore;
  private readonly workMemoryStore: WorkMemoryStore;
  private readonly eventLogStore: EventLogStore;
  private readonly now: () => Date;

  constructor(options: MemoryReviewServiceOptions) {
    this.memoryCandidateStore = options.memoryCandidateStore;
    this.privateMemoryStore = options.privateMemoryStore;
    this.sharedKnowledgeStore = options.sharedKnowledgeStore;
    this.workMemoryStore = options.workMemoryStore;
    this.eventLogStore = options.eventLogStore;
    this.now = options.now ?? (() => new Date());
  }

  acceptCandidate(input: ReviewCandidateInput): MemoryCandidateRecord | null {
    const existing = this.memoryCandidateStore.get(input.candidateId);
    if (!existing) {
      return null;
    }
    if (existing.status === "accepted") {
      return existing;
    }
    if (existing.status === "rejected") {
      return existing;
    }

    const reviewedAt = this.timestamp();
    const nextWorkMemory = this.applyCandidateToWorkMemory(existing, reviewedAt);
    const acceptedInto: Array<"l0" | "l2"> = nextWorkMemory ? ["l0", "l2"] : ["l2"];
    const accepted: MemoryCandidateRecord = {
      ...existing,
      status: "accepted",
      reviewedAt,
      reviewedBy: input.reviewedBy,
      acceptedInto
    };

    if (nextWorkMemory) {
      this.workMemoryStore.set(existing.roomId, nextWorkMemory);
    }
    this.memoryCandidateStore.save(accepted);
    this.sharedKnowledgeStore.create({
      knowledgeId: `know_${randomUUID()}`,
      spaceId: "space-default",
      roomId: accepted.roomId,
      kind: mapCandidateTypeToKnowledgeKind(accepted.candidateType),
      title: accepted.title,
      body: accepted.body,
      keywords: [],
      sourceCandidateId: accepted.candidateId,
      sourceEventIds: accepted.sourceEventIds,
      createdAt: reviewedAt,
      updatedAt: reviewedAt
    });
    this.appendMemoryEvent({
      roomId: accepted.roomId,
      actorParticipantId: input.reviewedBy,
      kind: "memory.candidate.accepted",
      payload: {
        candidateId: accepted.candidateId,
        candidateType: accepted.candidateType,
        acceptedInto: accepted.acceptedInto
      }
    });

    return accepted;
  }

  rejectCandidate(input: ReviewCandidateInput): MemoryCandidateRecord | null {
    const existing = this.memoryCandidateStore.get(input.candidateId);
    if (!existing) {
      return null;
    }
    if (existing.status === "accepted") {
      return existing;
    }

    const rejected: MemoryCandidateRecord = {
      ...existing,
      status: "rejected",
      reviewedAt: this.timestamp(),
      reviewedBy: input.reviewedBy,
      acceptedInto: []
    };

    this.memoryCandidateStore.save(rejected);
    this.appendMemoryEvent({
      roomId: rejected.roomId,
      actorParticipantId: input.reviewedBy,
      kind: "memory.candidate.rejected",
      payload: {
        candidateId: rejected.candidateId,
        candidateType: rejected.candidateType
      }
    });

    return rejected;
  }

  sharePrivateMemoryAsCandidate(input: SharePrivateMemoryInput): MemoryCandidateRecord | null {
    const memory = this.privateMemoryStore.get(input.memoryId);
    if (!memory) {
      return null;
    }
    if (memory.agentId !== input.agentId) {
      throw new Error("private_memory_forbidden");
    }

    const existingCandidate = this.memoryCandidateStore
      .list({
        roomId: memory.roomId,
        scope: "shared",
        status: "proposed"
      })
      .find(
        (candidate) =>
          candidate.candidateType === input.candidateType &&
          candidate.targetAgentId === memory.agentId &&
          candidate.sourceMemoryIds.includes(memory.memoryId)
      );
    if (existingCandidate) {
      return existingCandidate;
    }

    const createdAt = this.timestamp();
    const candidate: MemoryCandidateRecord = {
      candidateId: `cand_${randomUUID()}`,
      roomId: memory.roomId,
      scope: "shared",
      candidateType: input.candidateType,
      title: memory.title,
      body: memory.body,
      status: "proposed",
      proposedBy: `agent:${memory.agentId}`,
      sourceEventIds: memory.sourceEventIds,
      sourceMemoryIds: [memory.memoryId],
      targetAgentId: memory.agentId,
      createdAt,
      reviewedAt: null,
      reviewedBy: null,
      acceptedInto: []
    };

    this.memoryCandidateStore.create(candidate);
    this.appendMemoryEvent({
      roomId: memory.roomId,
      actorParticipantId: memory.agentId,
      kind: "memory.candidate.submitted",
      payload: {
        candidateId: candidate.candidateId,
        candidateType: candidate.candidateType,
        sourceMemoryIds: candidate.sourceMemoryIds
      }
    });

    return candidate;
  }

  private appendMemoryEvent(input: {
    roomId: string;
    actorParticipantId: string;
    kind: string;
    payload: Record<string, unknown>;
  }): void {
    this.eventLogStore.append({
      eventId: `evt_${randomUUID()}`,
      spaceId: "space-default",
      roomId: input.roomId,
      kind: input.kind,
      actorParticipantId: input.actorParticipantId,
      timestamp: this.timestamp(),
      payload: input.payload,
      source: inferEventSource(input.actorParticipantId),
      causationId: null,
      correlationId: null
    });
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private applyCandidateToWorkMemory(
    candidate: MemoryCandidateRecord,
    updatedAt: string
  ): WorkMemoryRecord | null {
    const current = this.workMemoryStore.get(candidate.roomId) ?? createEmptyWorkMemory(candidate.roomId, updatedAt);

    switch (candidate.candidateType) {
      case "todo":
        return {
          ...current,
          todoItems: appendUnique(current.todoItems, candidate.title),
          updatedAt
        };
      case "blocker":
        return {
          ...current,
          blockerItems: appendUnique(current.blockerItems, candidate.title),
          updatedAt
        };
      case "decision":
        return {
          ...current,
          decisionItems: appendUnique(current.decisionItems, candidate.title),
          updatedAt
        };
      case "summary":
        return {
          ...current,
          lastSummaryDraftId: candidate.candidateId,
          updatedAt
        };
    }
  }
}

function appendUnique(items: string[], item: string): string[] {
  return items.includes(item) ? items : [...items, item];
}
