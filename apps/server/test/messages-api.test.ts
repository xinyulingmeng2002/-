import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildServer } from "../src/app";
import { createEventLogStore } from "../src/domain/messages/event-log-store";
import { MessageService } from "../src/domain/messages/message-service";
import { createWorkMemoryStore } from "../src/domain/memory/work-memory-store";
import { cleanupTempDir, createTempDir } from "./helpers";

function readRoomEvents(dataDir: string, roomId: string) {
  const logPath = join(dataDir, "data", "logs", "rooms", `${roomId}.jsonl`);
  if (!existsSync(logPath)) {
    return [];
  }

  const lines = readFileSync(logPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("message service", () => {
  it("stores each message in the room event log before updating work memory", async () => {
    const tempDir = createTempDir();
    const roomId = "room-1";
    const workMemoryPath = join(tempDir, "data", "db", "work-memory.json");
    const logPath = join(tempDir, "data", "logs", "rooms", `${roomId}.jsonl`);
    mkdirSync(join(tempDir, "data", "logs", "rooms"), { recursive: true });
    writeFileSync(logPath, "", "utf8");

    const service = new MessageService({
      eventLogStore: createEventLogStore(tempDir),
      workMemoryStore: createWorkMemoryStore(tempDir),
      now: () => new Date("2026-04-15T12:00:00.000Z")
    });

    try {
      await service.appendChatMessage({
        roomId,
        speakerParticipantId: "human-1",
        body: "今天先把房间打通"
      });

      expect(readRoomEvents(tempDir, roomId)).toHaveLength(1);
      expect(existsSync(workMemoryPath)).toBe(true);
      expect(readRoomEvents(tempDir, roomId)[0]?.kind).toBe("message.created");
      expect(createWorkMemoryStore(tempDir).get(roomId)?.recentMessages[0]?.body).toBe(
        "今天先把房间打通"
      );
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describe("messages api", () => {
  it("creates message events and lists room events", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId: "room-1",
          speakerParticipantId: "human-1",
          body: "先写日志"
        }
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toEqual(
        expect.objectContaining({
          kind: "message.created",
          roomId: "room-1"
        })
      );

      const listed = await app.inject({
        method: "GET",
        url: "/api/messages?roomId=room-1"
      });

      expect(listed.statusCode).toBe(200);
      expect(listed.json().items).toHaveLength(1);
      expect(listed.json().items[0]).toEqual(
        expect.objectContaining({
          kind: "message.created",
          roomId: "room-1"
        })
      );
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
