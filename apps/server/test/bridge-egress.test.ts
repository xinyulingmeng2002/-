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

  it("returns attachments on egress for bridge-created attachment messages", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir, now: () => new Date("2026-04-15T14:10:00.000Z") });

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
          capabilities: ["chat"]
        }
      });
      const sessionId = connected.json().session.id as string;

      await app.inject({
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

      const created = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/message",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          sessionId,
          agentId: "agent-codex",
          roomId: "room-1",
          body: "请看图",
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

      const listed = await app.inject({
        method: "GET",
        url: `/api/bridge/egress/events?agentId=agent-codex&sessionId=${sessionId}&roomId=room-1`,
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toEqual({
        items: [
          expect.objectContaining({
            payload: expect.objectContaining({
              body: "请看图",
              attachments: [
                expect.objectContaining({
                  id: "att-1",
                  name: "diagram.png",
                  mimeType: "image/png"
                })
              ]
            })
          })
        ],
        nextCursor: created.json().eventId
      });
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("rejects a sessionId that belongs to another token or agent", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir, now: () => new Date("2026-04-15T15:00:00.000Z") });

    try {
      const tokenA = await app.inject({
        method: "POST",
        url: "/api/bridge-tokens",
        payload: {
          label: "Codex A",
          bridgeKind: "codex",
          allowedRoomIds: ["room-1"]
        }
      });
      const tokenB = await app.inject({
        method: "POST",
        url: "/api/bridge-tokens",
        payload: {
          label: "Codex B",
          bridgeKind: "codex",
          allowedRoomIds: ["room-1"]
        }
      });

      const connectA = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/connect",
        headers: {
          authorization: `Bearer ${tokenA.json().token as string}`
        },
        payload: {
          agentId: "agent-a",
          displayName: "Agent A",
          capabilities: ["chat"]
        }
      });
      const sessionIdA = connectA.json().session.id as string;

      const joinA = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/join-room",
        headers: {
          authorization: `Bearer ${tokenA.json().token as string}`
        },
        payload: {
          sessionId: sessionIdA,
          agentId: "agent-a",
          roomId: "room-1"
        }
      });
      expect(joinA.statusCode).toBe(200);

      const connectB = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/connect",
        headers: {
          authorization: `Bearer ${tokenB.json().token as string}`
        },
        payload: {
          agentId: "agent-b",
          displayName: "Agent B",
          capabilities: ["chat"]
        }
      });
      expect(connectB.statusCode).toBe(201);

      const listed = await app.inject({
        method: "GET",
        url: `/api/bridge/egress/events?agentId=agent-b&sessionId=${sessionIdA}&roomId=room-1`,
        headers: {
          authorization: `Bearer ${tokenB.json().token as string}`
        }
      });

      expect(listed.statusCode).toBe(404);
      expect(listed.json()).toEqual({
        error: "bridge session not found"
      });
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("returns the latest event window when the cursor is stale", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir, now: () => new Date("2026-04-15T16:00:00.000Z") });

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
          capabilities: ["chat"]
        }
      });
      const sessionId = connected.json().session.id as string;

      await app.inject({
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

      const first = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId: "room-1",
          speakerParticipantId: "human-owner",
          body: "第一条"
        }
      });
      const second = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId: "room-1",
          speakerParticipantId: "human-owner",
          body: "第二条"
        }
      });
      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);

      const listed = await app.inject({
        method: "GET",
        url: `/api/bridge/egress/events?agentId=agent-codex&sessionId=${sessionId}&roomId=room-1&afterEventId=evt-missing&limit=1`,
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toEqual({
        items: [
          expect.objectContaining({
            eventId: second.json().eventId,
            payload: expect.objectContaining({
              body: "第二条"
            })
          })
        ],
        nextCursor: second.json().eventId
      });
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
