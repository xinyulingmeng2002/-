import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { createEventLogStore } from "../src/domain/messages/event-log-store";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("private memories api", () => {
  it("creates and lists private memories for one agent namespace", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/private-memories",
        payload: {
          agentId: "agent-codex",
          roomId: "room-1",
          memoryType: "task-context",
          title: "Bridge follow-up",
          body: "Need to follow up after review.",
          tags: ["bridge", "follow-up"],
          confidence: 0.8,
          sourceEventIds: ["evt-1"]
        }
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toEqual(
        expect.objectContaining({
          agentId: "agent-codex",
          roomId: "room-1",
          memoryType: "task-context",
          visibility: "private"
        })
      );

      const listed = await app.inject({
        method: "GET",
        url: "/api/private-memories?agentId=agent-codex"
      });

      expect(listed.statusCode).toBe(200);
      expect(listed.json().items).toHaveLength(1);
      expect(listed.json().items[0]).toEqual(
        expect.objectContaining({
          agentId: "agent-codex",
          roomId: "room-1"
        })
      );
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("requires agentId when listing private memories", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/private-memories"
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "agentId is required" });
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("turns one private memory into a shared candidate for later human review", async () => {
    const tempDir = createTempDir();
    const eventLogStore = createEventLogStore(tempDir);
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/private-memories",
        payload: {
          agentId: "agent-codex",
          roomId: "room-1",
          memoryType: "insight",
          title: "Review flow",
          body: "We should route this through candidate review.",
          tags: ["review"],
          confidence: 0.9,
          sourceEventIds: ["evt-1"]
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
      expect(shared.json()).toEqual(
        expect.objectContaining({
          roomId: "room-1",
          scope: "shared",
          candidateType: "decision",
          proposedBy: "agent:agent-codex",
          targetAgentId: "agent-codex",
          sourceMemoryIds: [created.json().memoryId]
        })
      );

      const candidates = await app.inject({
        method: "GET",
        url: "/api/memory-candidates?roomId=room-1&scope=shared&status=proposed"
      });

      expect(candidates.statusCode).toBe(200);
      expect(candidates.json().items).toEqual([
        expect.objectContaining({
          roomId: "room-1",
          sourceMemoryIds: [created.json().memoryId]
        })
      ]);

      expect(eventLogStore.list("room-1")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "memory.candidate.submitted",
            roomId: "room-1",
            actorParticipantId: "agent-codex",
            source: "agent"
          })
        ])
      );
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("creates a private memory automatically from an agent remember message", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId: "room-2",
          speakerParticipantId: "agent-codex",
          body: "Remember: route future notes through candidate review."
        }
      });

      expect(created.statusCode).toBe(201);

      const listed = await app.inject({
        method: "GET",
        url: "/api/private-memories?agentId=agent-codex&roomId=room-2"
      });

      expect(listed.statusCode).toBe(200);
      expect(listed.json().items).toEqual([
        expect.objectContaining({
          agentId: "agent-codex",
          roomId: "room-2",
          memoryType: "insight",
          visibility: "private"
        })
      ]);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
