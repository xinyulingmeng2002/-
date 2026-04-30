import { describe, expect, it } from "vitest";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildServer } from "../src/app";
import { createEventLogStore, type RoomEventRecord } from "../src/domain/messages/event-log-store";
import { MessageService } from "../src/domain/messages/message-service";
import type { WorkMemoryRecord } from "../src/domain/memory/work-memory-store";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("message service", () => {
  it("stores each message in the room event log before updating work memory", async () => {
    const calls: string[] = [];
    const events: RoomEventRecord[] = [];
    const memoryByRoom: Record<string, WorkMemoryRecord> = {};

    const service = new MessageService({
      eventLogStore: {
        append(event) {
          calls.push("eventLog.append");
          events.push(event);
        },
        list() {
          return events;
        }
      },
      workMemoryStore: {
        get(roomId) {
          calls.push("workMemory.get");
          return memoryByRoom[roomId];
        },
        set(roomId, memory) {
          calls.push("workMemory.set");
          memoryByRoom[roomId] = memory;
        }
      },
      now: () => new Date("2026-04-15T12:00:00.000Z")
    });

    await service.appendChatMessage({
      roomId: "room-1",
      speakerParticipantId: "human-1",
      body: "今天先把房间打通"
    });

    expect(calls).toEqual(["eventLog.append", "workMemory.get", "workMemory.set"]);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        spaceId: "space-default",
        actorParticipantId: "human-1",
        source: "human",
        causationId: null,
        correlationId: null
      })
    );
    expect(memoryByRoom["room-1"]?.recentMessages[0]?.body).toBe("今天先把房间打通");
    expect(memoryByRoom["room-1"]).toEqual(
      expect.objectContaining({
        roomId: "room-1",
        blockerItems: [],
        decisionItems: [],
        lastSummaryDraftId: null
      })
    );
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
          roomId: "room-1",
          spaceId: "space-default",
          actorParticipantId: "human-1",
          source: "human",
          causationId: null,
          correlationId: null
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
          roomId: "room-1",
          spaceId: "space-default",
          actorParticipantId: "human-1",
          source: "human"
        })
      );
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("creates a canonical attachment message with an empty body", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId: "room-1",
          speakerParticipantId: "human-1",
          body: "",
          attachments: [
            {
              id: "att-1",
              messageId: "",
              kind: "image",
              url: "https://example.com/uploads/diagram.png",
              name: "diagram.png",
              mimeType: "image/png",
              sizeBytes: 2048
            }
          ]
        }
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toEqual(
        expect.objectContaining({
          kind: "message.created",
          payload: expect.objectContaining({
            body: "",
            attachments: [
              expect.objectContaining({
                id: "att-1",
                kind: "image",
                url: "https://example.com/uploads/diagram.png",
                name: "diagram.png",
                mimeType: "image/png",
                sizeBytes: 2048,
                messageId: expect.any(String)
              })
            ]
          })
        })
      );

      const event = created.json();
      expect(event.payload.attachments[0].messageId).toBe(event.payload.messageId);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("rejects unsafe roomId in create message request", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId: "../escape",
          speakerParticipantId: "human-1",
          body: "bad room id"
        }
      });

      expect(created.statusCode).toBe(400);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("rejects a message when both body and attachments are empty", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId: "room-1",
          speakerParticipantId: "human-1",
          body: "",
          attachments: []
        }
      });

      expect(created.statusCode).toBe(400);
      expect(created.json()).toEqual({
        error: "body or attachments are required"
      });
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("rejects overlong speakerParticipantId and body", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });
    const longSpeakerId = "s".repeat(129);
    const longBody = "b".repeat(4001);

    try {
      const speakerTooLong = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId: "room-1",
          speakerParticipantId: longSpeakerId,
          body: "ok"
        }
      });
      expect(speakerTooLong.statusCode).toBe(400);

      const bodyTooLong = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId: "room-1",
          speakerParticipantId: "human-1",
          body: longBody
        }
      });
      expect(bodyTooLong.statusCode).toBe(400);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("returns sanitized 500 when room log has a corrupted middle line", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });
    const roomId = "room-1";
    const logPath = join(tempDir, "data", "logs", "rooms", `${roomId}.jsonl`);

    try {
      mkdirSync(join(tempDir, "data", "logs", "rooms"), { recursive: true });
      writeFileSync(
        logPath,
        [
          "{\"eventId\":\"evt_1\",\"kind\":\"message.created\",\"roomId\":\"room-1\",\"timestamp\":\"2026-04-15T12:00:00.000Z\",\"payload\":{}}",
          "{\"eventId\":\"evt_2\"",
          "{\"eventId\":\"evt_3\",\"kind\":\"message.created\",\"roomId\":\"room-1\",\"timestamp\":\"2026-04-15T12:00:02.000Z\",\"payload\":{}}",
          ""
        ].join("\n"),
        "utf8"
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/messages?roomId=room-1"
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "message log read failed" });
      expect(response.body).not.toContain(tempDir);
      expect(response.body).not.toContain(logPath);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});

describe("event log store", () => {
  it("keeps readable events when the final jsonl line is truncated", () => {
    const tempDir = createTempDir();
    const store = createEventLogStore(tempDir);
    const roomId = "room_1";
    const logPath = join(tempDir, "data", "logs", "rooms", `${roomId}.jsonl`);

    try {
      store.append({
        eventId: "evt_1",
        spaceId: "space-default",
        kind: "message.created",
        roomId,
        actorParticipantId: "human-1",
        timestamp: "2026-04-15T12:00:00.000Z",
        payload: { body: "ok" },
        source: "human",
        causationId: null,
        correlationId: null
      });
      appendFileSync(logPath, "{\"eventId\":\"evt_2\"", "utf8");

      const listed = store.list(roomId);
      expect(listed).toHaveLength(1);
      expect(listed[0]?.eventId).toBe("evt_1");
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
