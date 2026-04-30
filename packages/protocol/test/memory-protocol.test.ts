import { describe, expect, it } from "vitest";
import {
  eventRecordSchema,
  memoryCandidateSchema,
  privateMemorySchema,
  sharedKnowledgeSchema,
  workMemoryRecordSchema
} from "../src";

describe("memory protocol schemas", () => {
  it("accepts the next-stage event, work memory, candidate, knowledge, and private memory objects", () => {
    expect(
      eventRecordSchema.parse({
        eventId: "evt-1",
        roomId: "room-1",
        spaceId: "space-1",
        kind: "message.created",
        actorParticipantId: "human-1",
        timestamp: "2026-04-30T00:00:00.000Z",
        payload: { body: "hello" },
        source: "human",
        causationId: null,
        correlationId: null
      })
    ).toEqual(
      expect.objectContaining({
        eventId: "evt-1",
        source: "human"
      })
    );

    expect(
      workMemoryRecordSchema.parse({
        roomId: "room-1",
        recentMessages: [],
        activeParticipantIds: ["human-1"],
        todoItems: [],
        blockerItems: [],
        decisionItems: [],
        lastSummaryDraftId: null,
        updatedAt: "2026-04-30T00:00:00.000Z"
      })
    ).toEqual(
      expect.objectContaining({
        roomId: "room-1"
      })
    );

    expect(
      memoryCandidateSchema.parse({
        candidateId: "cand-1",
        roomId: "room-1",
        scope: "shared",
        candidateType: "todo",
        title: "todo",
        body: "follow up",
        status: "proposed",
        proposedBy: "observer",
        sourceEventIds: ["evt-1"],
        sourceMemoryIds: [],
        targetAgentId: null,
        createdAt: "2026-04-30T00:00:00.000Z",
        reviewedAt: null,
        reviewedBy: null,
        acceptedInto: []
      })
    ).toEqual(
      expect.objectContaining({
        candidateId: "cand-1",
        candidateType: "todo"
      })
    );

    expect(
      sharedKnowledgeSchema.parse({
        knowledgeId: "know-1",
        spaceId: "space-1",
        roomId: "room-1",
        kind: "decision",
        title: "Decision",
        body: "Use candidate review.",
        keywords: ["decision", "candidate"],
        sourceCandidateId: "cand-1",
        sourceEventIds: ["evt-1"],
        createdAt: "2026-04-30T00:00:00.000Z",
        updatedAt: "2026-04-30T00:00:00.000Z"
      })
    ).toEqual(
      expect.objectContaining({
        knowledgeId: "know-1",
        kind: "decision"
      })
    );

    expect(
      privateMemorySchema.parse({
        memoryId: "mem-1",
        agentId: "agent-codex",
        roomId: "room-1",
        memoryType: "task-context",
        title: "Context",
        body: "Need follow-up after review.",
        tags: ["follow-up"],
        confidence: 0.8,
        visibility: "private",
        sourceEventIds: ["evt-1"],
        createdAt: "2026-04-30T00:00:00.000Z",
        updatedAt: "2026-04-30T00:00:00.000Z",
        lastReferencedAt: null
      })
    ).toEqual(
      expect.objectContaining({
        memoryId: "mem-1",
        visibility: "private"
      })
    );
  });

  it("rejects unsupported candidate scopes and private memory visibilities", () => {
    expect(() =>
      memoryCandidateSchema.parse({
        candidateId: "cand-1",
        roomId: "room-1",
        scope: "public",
        candidateType: "todo",
        title: "todo",
        body: "follow up",
        status: "proposed",
        proposedBy: "observer",
        sourceEventIds: [],
        sourceMemoryIds: [],
        targetAgentId: null,
        createdAt: "2026-04-30T00:00:00.000Z",
        reviewedAt: null,
        reviewedBy: null,
        acceptedInto: []
      })
    ).toThrow();

    expect(() =>
      privateMemorySchema.parse({
        memoryId: "mem-1",
        agentId: "agent-codex",
        roomId: "room-1",
        memoryType: "note",
        title: "Context",
        body: "Need follow-up after review.",
        tags: [],
        confidence: 0.5,
        visibility: "shared",
        sourceEventIds: [],
        createdAt: "2026-04-30T00:00:00.000Z",
        updatedAt: "2026-04-30T00:00:00.000Z",
        lastReferencedAt: null
      })
    ).toThrow();
  });
});
