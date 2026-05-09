import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { createMemoryCandidateStore } from "../src/domain/memory/memory-candidate-store";
import { createEventLogStore } from "../src/domain/messages/event-log-store";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("memory candidates api", () => {
  it("lists shared candidates with room and status filters", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/memory-candidates?roomId=room-1&scope=shared&status=proposed"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ items: [] });
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("accepts a shared candidate into shared knowledge and logs an acceptance event", async () => {
    const tempDir = createTempDir();
    const candidateStore = createMemoryCandidateStore(tempDir);
    const eventLogStore = createEventLogStore(tempDir);
    const app = buildServer({ dataDir: tempDir });

    candidateStore.create({
      candidateId: "cand-1",
      roomId: "room-1",
      scope: "shared",
      candidateType: "decision",
      title: "Use candidate review",
      body: "Route private sharing through candidates.",
      status: "proposed",
      proposedBy: "observer",
      sourceEventIds: ["evt-1"],
      sourceMemoryIds: [],
      targetAgentId: null,
      createdAt: "2026-04-30T00:00:00.000Z",
      reviewedAt: null,
      reviewedBy: null,
      acceptedInto: []
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/memory-candidates/cand-1/accept",
        payload: {
          reviewedBy: "human-1"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(
        expect.objectContaining({
          candidateId: "cand-1",
          status: "accepted",
          reviewedBy: "human-1",
          acceptedInto: ["l0", "l2"]
        })
      );

      const knowledge = await app.inject({
        method: "GET",
        url: "/api/shared-knowledge?roomId=room-1"
      });

      expect(knowledge.statusCode).toBe(200);
      expect(knowledge.json().items).toEqual([
        expect.objectContaining({
          roomId: "room-1",
          kind: "decision",
          sourceCandidateId: "cand-1"
        })
      ]);

      expect(eventLogStore.list("room-1")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "memory.candidate.accepted",
            roomId: "room-1",
            actorParticipantId: "human-1",
            source: "human"
          })
        ])
      );

      const workMemory = await app.inject({
        method: "GET",
        url: "/api/work-memory?roomId=room-1"
      });

      expect(workMemory.statusCode).toBe(200);
      expect(workMemory.json()).toEqual(
        expect.objectContaining({
          roomId: "room-1",
          decisionItems: ["Use candidate review"],
          todoItems: [],
          blockerItems: []
        })
      );
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("rejects a candidate and logs a rejection event without creating shared knowledge", async () => {
    const tempDir = createTempDir();
    const candidateStore = createMemoryCandidateStore(tempDir);
    const eventLogStore = createEventLogStore(tempDir);
    const app = buildServer({ dataDir: tempDir });

    candidateStore.create({
      candidateId: "cand-2",
      roomId: "room-1",
      scope: "shared",
      candidateType: "todo",
      title: "Follow up",
      body: "Check candidate review flow.",
      status: "proposed",
      proposedBy: "observer",
      sourceEventIds: ["evt-1"],
      sourceMemoryIds: [],
      targetAgentId: null,
      createdAt: "2026-04-30T00:00:00.000Z",
      reviewedAt: null,
      reviewedBy: null,
      acceptedInto: []
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/memory-candidates/cand-2/reject",
        payload: {
          reviewedBy: "human-1"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(
        expect.objectContaining({
          candidateId: "cand-2",
          status: "rejected",
          reviewedBy: "human-1",
          acceptedInto: []
        })
      );

      const knowledge = await app.inject({
        method: "GET",
        url: "/api/shared-knowledge?roomId=room-1"
      });

      expect(knowledge.statusCode).toBe(200);
      expect(knowledge.json()).toEqual({ items: [] });

      expect(eventLogStore.list("room-1")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "memory.candidate.rejected",
            roomId: "room-1",
            actorParticipantId: "human-1",
            source: "human"
          })
        ])
      );
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("creates a shared candidate automatically after a room message expresses needed work", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId: "room-1",
          speakerParticipantId: "human-1",
          body: "We need a rollout checklist before release."
        }
      });

      expect(created.statusCode).toBe(201);

      const candidates = await app.inject({
        method: "GET",
        url: "/api/memory-candidates?roomId=room-1&scope=shared&status=proposed"
      });

      expect(candidates.statusCode).toBe(200);
      expect(candidates.json().items).toEqual([
        expect.objectContaining({
          roomId: "room-1",
          candidateType: "todo",
          proposedBy: "observer"
        })
      ]);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("accepts a todo candidate into work memory and shared knowledge", async () => {
    const tempDir = createTempDir();
    const candidateStore = createMemoryCandidateStore(tempDir);
    const app = buildServer({ dataDir: tempDir });

    candidateStore.create({
      candidateId: "cand-3",
      roomId: "room-2",
      scope: "shared",
      candidateType: "todo",
      title: "补工作记忆面板",
      body: "Add an explicit work memory panel to the room shell.",
      status: "proposed",
      proposedBy: "observer",
      sourceEventIds: ["evt-3"],
      sourceMemoryIds: [],
      targetAgentId: null,
      createdAt: "2026-04-30T00:00:00.000Z",
      reviewedAt: null,
      reviewedBy: null,
      acceptedInto: []
    });

    try {
      const accepted = await app.inject({
        method: "POST",
        url: "/api/memory-candidates/cand-3/accept",
        payload: {
          reviewedBy: "human-1"
        }
      });

      expect(accepted.statusCode).toBe(200);
      expect(accepted.json()).toEqual(
        expect.objectContaining({
          acceptedInto: ["l0", "l2"]
        })
      );

      const workMemory = await app.inject({
        method: "GET",
        url: "/api/work-memory?roomId=room-2"
      });

      expect(workMemory.statusCode).toBe(200);
      expect(workMemory.json()).toEqual(
        expect.objectContaining({
          roomId: "room-2",
          todoItems: ["补工作记忆面板"]
        })
      );
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("does not duplicate shared knowledge when the same candidate is accepted twice", async () => {
    const tempDir = createTempDir();
    const candidateStore = createMemoryCandidateStore(tempDir);
    const eventLogStore = createEventLogStore(tempDir);
    const app = buildServer({ dataDir: tempDir });

    candidateStore.create({
      candidateId: "cand-4",
      roomId: "room-4",
      scope: "shared",
      candidateType: "decision",
      title: "Keep acceptance idempotent",
      body: "Do not duplicate shared knowledge on repeated review clicks.",
      status: "proposed",
      proposedBy: "observer",
      sourceEventIds: ["evt-4"],
      sourceMemoryIds: [],
      targetAgentId: null,
      createdAt: "2026-04-30T00:00:00.000Z",
      reviewedAt: null,
      reviewedBy: null,
      acceptedInto: []
    });

    try {
      const firstAccept = await app.inject({
        method: "POST",
        url: "/api/memory-candidates/cand-4/accept",
        payload: {
          reviewedBy: "human-1"
        }
      });
      const secondAccept = await app.inject({
        method: "POST",
        url: "/api/memory-candidates/cand-4/accept",
        payload: {
          reviewedBy: "human-1"
        }
      });

      expect(firstAccept.statusCode).toBe(200);
      expect(secondAccept.statusCode).toBe(200);

      const knowledge = await app.inject({
        method: "GET",
        url: "/api/shared-knowledge?roomId=room-4"
      });

      expect(knowledge.statusCode).toBe(200);
      expect(knowledge.json().items).toHaveLength(1);
      expect(knowledge.json().items[0]).toEqual(
        expect.objectContaining({
          sourceCandidateId: "cand-4",
          sourceEventIds: ["evt-4"]
        })
      );

      expect(
        eventLogStore.list("room-4").filter((event) => event.kind === "memory.candidate.accepted")
      ).toHaveLength(1);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("does not let an accepted candidate transition back to rejected", async () => {
    const tempDir = createTempDir();
    const candidateStore = createMemoryCandidateStore(tempDir);
    const eventLogStore = createEventLogStore(tempDir);
    const app = buildServer({ dataDir: tempDir });

    candidateStore.create({
      candidateId: "cand-5",
      roomId: "room-5",
      scope: "shared",
      candidateType: "decision",
      title: "Keep review terminal",
      body: "Accepted candidates should not flip back to rejected.",
      status: "proposed",
      proposedBy: "observer",
      sourceEventIds: ["evt-5"],
      sourceMemoryIds: [],
      targetAgentId: null,
      createdAt: "2026-04-30T00:00:00.000Z",
      reviewedAt: null,
      reviewedBy: null,
      acceptedInto: []
    });

    try {
      const accepted = await app.inject({
        method: "POST",
        url: "/api/memory-candidates/cand-5/accept",
        payload: {
          reviewedBy: "human-1"
        }
      });
      const rejected = await app.inject({
        method: "POST",
        url: "/api/memory-candidates/cand-5/reject",
        payload: {
          reviewedBy: "human-1"
        }
      });

      expect(accepted.statusCode).toBe(200);
      expect(rejected.statusCode).toBe(200);
      expect(rejected.json()).toEqual(
        expect.objectContaining({
          candidateId: "cand-5",
          status: "accepted",
          acceptedInto: ["l0", "l2"]
        })
      );

      const knowledge = await app.inject({
        method: "GET",
        url: "/api/shared-knowledge?roomId=room-5"
      });

      expect(knowledge.statusCode).toBe(200);
      expect(knowledge.json().items).toHaveLength(1);
      expect(
        eventLogStore.list("room-5").filter((event) => event.kind === "memory.candidate.rejected")
      ).toHaveLength(0);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
