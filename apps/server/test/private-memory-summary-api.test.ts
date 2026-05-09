import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("private memory summary api", () => {
  it("returns redacted private memory overview grouped by agent", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/private-memories",
        payload: {
          agentId: "agent-codex",
          roomId: "room-1",
          memoryType: "insight",
          title: "Internal bridge note",
          body: "Route this through candidate review after triage.",
          tags: ["bridge", "review"],
          confidence: 0.9,
          sourceEventIds: ["evt-1"]
        }
      });

      expect(created.statusCode).toBe(201);

      const response = await app.inject({
        method: "GET",
        url: "/api/private-memories/summary?roomId=room-1"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [
          expect.objectContaining({
            agentId: "agent-codex",
            roomId: "room-1",
            totalMemories: 1,
            shareableMemories: 1,
            suggestedShareCandidate: {
              memoryId: created.json().memoryId,
              candidateType: "decision"
            }
          })
        ]
      });
      expect(response.json().items[0]).not.toHaveProperty("title");
      expect(response.json().items[0]).not.toHaveProperty("body");
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("marks private memory as pending review after it becomes a proposed shared candidate", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/private-memories",
        payload: {
          agentId: "agent-codex",
          roomId: "room-2",
          memoryType: "insight",
          title: "Promote once",
          body: "Share this through review.",
          tags: ["review"],
          confidence: 0.8,
          sourceEventIds: ["evt-2"]
        }
      });

      expect(created.statusCode).toBe(201);

      const shared = await app.inject({
        method: "POST",
        url: `/api/private-memories/${created.json().memoryId as string}/share-candidate`,
        payload: {
          agentId: "agent-codex",
          candidateType: "decision"
        }
      });

      expect(shared.statusCode).toBe(201);

      const response = await app.inject({
        method: "GET",
        url: "/api/private-memories/summary?roomId=room-2"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [
          expect.objectContaining({
            agentId: "agent-codex",
            roomId: "room-2",
            shareableMemories: 0,
            suggestedShareCandidate: null,
            pendingShareCandidate: {
              candidateId: shared.json().candidateId,
              candidateType: "decision",
              memoryId: created.json().memoryId,
              submittedAt: shared.json().createdAt
            }
          })
        ]
      });
      expect(response.json().items[0]).not.toHaveProperty("title");
      expect(response.json().items[0]).not.toHaveProperty("body");
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("marks private memory as accepted after human review completes", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/private-memories",
        payload: {
          agentId: "agent-codex",
          roomId: "room-3",
          memoryType: "insight",
          title: "Ship review",
          body: "Share this and accept it.",
          tags: ["review"],
          confidence: 0.8,
          sourceEventIds: ["evt-3"]
        }
      });

      const shared = await app.inject({
        method: "POST",
        url: `/api/private-memories/${created.json().memoryId as string}/share-candidate`,
        payload: {
          agentId: "agent-codex",
          candidateType: "decision"
        }
      });

      expect(shared.statusCode).toBe(201);

      const accepted = await app.inject({
        method: "POST",
        url: `/api/memory-candidates/${shared.json().candidateId as string}/accept`,
        payload: {
          reviewedBy: "human-1"
        }
      });

      expect(accepted.statusCode).toBe(200);

      const response = await app.inject({
        method: "GET",
        url: "/api/private-memories/summary?roomId=room-3"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [
          expect.objectContaining({
            agentId: "agent-codex",
            roomId: "room-3",
            pendingShareCandidate: null,
            latestShareOutcome: {
              candidateId: shared.json().candidateId,
              candidateType: "decision",
              memoryId: created.json().memoryId,
              status: "accepted",
              reviewedAt: accepted.json().reviewedAt
            }
          })
        ]
      });
      expect(response.json().items[0]).not.toHaveProperty("title");
      expect(response.json().items[0]).not.toHaveProperty("body");
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("marks private memory as rejected after human review rejects the candidate", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/private-memories",
        payload: {
          agentId: "agent-codex",
          roomId: "room-4",
          memoryType: "insight",
          title: "Reject review",
          body: "Share this and reject it.",
          tags: ["review"],
          confidence: 0.8,
          sourceEventIds: ["evt-4"]
        }
      });

      const shared = await app.inject({
        method: "POST",
        url: `/api/private-memories/${created.json().memoryId as string}/share-candidate`,
        payload: {
          agentId: "agent-codex",
          candidateType: "decision"
        }
      });

      expect(shared.statusCode).toBe(201);

      const rejected = await app.inject({
        method: "POST",
        url: `/api/memory-candidates/${shared.json().candidateId as string}/reject`,
        payload: {
          reviewedBy: "human-1"
        }
      });

      expect(rejected.statusCode).toBe(200);

      const response = await app.inject({
        method: "GET",
        url: "/api/private-memories/summary?roomId=room-4"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [
          expect.objectContaining({
            agentId: "agent-codex",
            roomId: "room-4",
            pendingShareCandidate: null,
            latestShareOutcome: {
              candidateId: shared.json().candidateId,
              candidateType: "decision",
              memoryId: created.json().memoryId,
              status: "rejected",
              reviewedAt: rejected.json().reviewedAt
            }
          })
        ]
      });
      expect(response.json().items[0]).not.toHaveProperty("title");
      expect(response.json().items[0]).not.toHaveProperty("body");
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
