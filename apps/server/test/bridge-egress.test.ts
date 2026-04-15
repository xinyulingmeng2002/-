import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("bridge egress", () => {
  it("lists room events for a joined bridge session and supports cursor-based polling", async () => {
    const tempDir = createTempDir();
    let currentTime = new Date("2026-04-15T14:00:00.000Z");
    const app = buildServer({ dataDir: tempDir, now: () => currentTime });

    try {
      const tokenCreated = await app.inject({
        method: "POST",
        url: "/api/bridge-tokens",
        payload: {
          label: "Codex bridge",
          bridgeKind: "codex",
          allowedRoomIds: ["room-1"]
        }
      });
      const token = tokenCreated.json().token as string;

      const connected = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/connect",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          agentId: "agent-codex",
          displayName: "Codex",
          capabilities: ["chat", "code"]
        }
      });
      const sessionId = connected.json().session.id as string;

      const joined = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/join-room",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          sessionId,
          agentId: "agent-codex",
          roomId: "room-1"
        }
      });
      expect(joined.statusCode).toBe(200);

      const humanMessage = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId: "room-1",
          speakerParticipantId: "human-owner",
          body: "人类消息"
        }
      });
      expect(humanMessage.statusCode).toBe(201);

      currentTime = new Date("2026-04-15T14:00:30.000Z");

      const agentMessage = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/message",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          sessionId,
          agentId: "agent-codex",
          displayName: "Codex",
          capabilities: ["chat", "code"],
          roomId: "room-1",
          body: "桥接消息"
        }
      });
      expect(agentMessage.statusCode).toBe(201);
      const firstEventId = humanMessage.json().eventId as string;

      currentTime = new Date("2026-04-15T14:01:00.000Z");

      const listed = await app.inject({
        method: "GET",
        url: `/api/bridge/egress/events?agentId=agent-codex&sessionId=${sessionId}&roomId=room-1&afterEventId=${firstEventId}`,
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toEqual({
        items: [
          expect.objectContaining({
            kind: "message.created",
            roomId: "room-1",
            payload: expect.objectContaining({
              speakerParticipantId: "agent-codex",
              body: "桥接消息"
            })
          })
        ],
        nextCursor: agentMessage.json().eventId
      });

      const sessions = await app.inject({ method: "GET", url: "/api/bridge-sessions" });
      expect(sessions.statusCode).toBe(200);
      expect(sessions.json().items).toEqual([
        expect.objectContaining({
          id: sessionId,
          status: "connected",
          activeRoomIds: ["room-1"],
          lastSeenAt: "2026-04-15T14:01:00.000Z"
        })
      ]);

      const participants = await app.inject({ method: "GET", url: "/api/participants" });
      expect(participants.statusCode).toBe(200);
      expect(participants.json().items).toEqual([
        expect.objectContaining({
          id: "agent-codex",
          lastSeenAt: "2026-04-15T14:01:00.000Z"
        })
      ]);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
