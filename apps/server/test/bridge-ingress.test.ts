import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("bridge ingress", () => {
  it("registers an agent, binds its room, and appends a canonical message event", async () => {
    const tempDir = createTempDir();
    let currentTime = new Date("2026-04-15T12:00:00.000Z");
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
      const tokenId = tokenCreated.json().metadata.id as string;

      const response = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/message",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          agentId: "agent-codex",
          displayName: "Codex",
          capabilities: ["chat", "code"],
          roomId: "room-1",
          body: "Bridge ingress message"
        }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual(
        expect.objectContaining({
          kind: "message.created",
          roomId: "room-1",
          payload: expect.objectContaining({
            speakerParticipantId: "agent-codex",
            body: "Bridge ingress message"
          })
        })
      );

      const participants = await app.inject({ method: "GET", url: "/api/participants" });
      expect(participants.statusCode).toBe(200);
      expect(participants.json().items).toEqual([
        {
          id: "agent-codex",
          type: "agent",
          displayName: "Codex",
          bridgeKind: "codex",
          capabilities: ["chat", "code"],
          createdAt: "2026-04-15T12:00:00.000Z",
          lastSeenAt: "2026-04-15T12:00:00.000Z"
        }
      ]);

      const sessions = await app.inject({ method: "GET", url: "/api/bridge-sessions" });
      expect(sessions.statusCode).toBe(200);
      expect(sessions.json().items).toEqual([
        expect.objectContaining({
          tokenId,
          agentId: "agent-codex",
          status: "connected",
          activeRoomIds: ["room-1"],
          connectedAt: "2026-04-15T12:00:00.000Z",
          lastSeenAt: "2026-04-15T12:00:00.000Z"
        })
      ]);

      const messages = await app.inject({
        method: "GET",
        url: "/api/messages?roomId=room-1"
      });
      expect(messages.statusCode).toBe(200);
      expect(messages.json().items).toHaveLength(1);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("accepts a bridge message with body and attachments", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir, now: () => new Date("2026-04-15T12:30:00.000Z") });

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

      const response = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/message",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          agentId: "agent-codex",
          displayName: "Codex",
          capabilities: ["chat"],
          roomId: "room-1",
          body: "请看附件",
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

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual(
        expect.objectContaining({
          kind: "message.created",
          roomId: "room-1",
          payload: expect.objectContaining({
            speakerParticipantId: "agent-codex",
            body: "请看附件",
            attachments: [
              expect.objectContaining({
                id: "att-1",
                name: "diagram.png",
                mimeType: "image/png",
                sizeBytes: 2048,
                messageId: expect.any(String)
              })
            ]
          })
        })
      );
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("accepts a pure attachment bridge message", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir, now: () => new Date("2026-04-15T12:40:00.000Z") });

    try {
      const tokenCreated = await app.inject({
        method: "POST",
        url: "/api/bridge-tokens",
        payload: {
          label: "OpenClaw bridge",
          bridgeKind: "openclaw",
          allowedRoomIds: ["room-1"]
        }
      });
      const token = tokenCreated.json().token as string;

      const response = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/message",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          agentId: "agent-openclaw",
          roomId: "room-1",
          body: "",
          attachments: [
            {
              id: "att-2",
              messageId: "",
              kind: "file",
              url: "https://example.com/uploads/spec.pdf",
              name: "spec.pdf",
              mimeType: "application/pdf",
              sizeBytes: 8192
            }
          ]
        }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().payload.attachments).toEqual([
        expect.objectContaining({
          id: "att-2",
          kind: "file",
          name: "spec.pdf"
        })
      ]);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("rejects a bridge message when both body and attachments are empty", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir, now: () => new Date("2026-04-15T12:50:00.000Z") });

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

      const response = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/message",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          agentId: "agent-codex",
          roomId: "room-1",
          body: "",
          attachments: []
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "body or attachments are required"
      });
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("supports connect, heartbeat, join-room, and disconnect lifecycle", async () => {
    const tempDir = createTempDir();
    let currentTime = new Date("2026-04-15T13:00:00.000Z");
    const app = buildServer({ dataDir: tempDir, now: () => currentTime });

    try {
      const tokenCreated = await app.inject({
        method: "POST",
        url: "/api/bridge-tokens",
        payload: {
          label: "OpenClaw bridge",
          bridgeKind: "openclaw",
          allowedRoomIds: ["room-1", "room-2"]
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
          agentId: "agent-openclaw",
          displayName: "OpenClaw",
          capabilities: ["chat"]
        }
      });

      expect(connected.statusCode).toBe(201);
      expect(connected.json()).toEqual(
        expect.objectContaining({
          participant: expect.objectContaining({
            id: "agent-openclaw",
            displayName: "OpenClaw"
          }),
          session: expect.objectContaining({
            agentId: "agent-openclaw",
            status: "connected",
            activeRoomIds: []
          })
        })
      );
      const sessionId = connected.json().session.id as string;

      currentTime = new Date("2026-04-15T13:01:30.000Z");

      const heartbeat = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/heartbeat",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          sessionId,
          agentId: "agent-openclaw"
        }
      });

      expect(heartbeat.statusCode).toBe(200);
      expect(heartbeat.json()).toEqual(
        expect.objectContaining({
          id: sessionId,
          status: "connected",
          lastSeenAt: "2026-04-15T13:01:30.000Z"
        })
      );

      currentTime = new Date("2026-04-15T13:02:30.000Z");

      const joined = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/join-room",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          sessionId,
          agentId: "agent-openclaw",
          roomId: "room-2"
        }
      });

      expect(joined.statusCode).toBe(200);
      expect(joined.json()).toEqual(
        expect.objectContaining({
          id: sessionId,
          activeRoomIds: ["room-2"]
        })
      );

      const listedWhileConnected = await app.inject({
        method: "GET",
        url: "/api/bridge-sessions"
      });
      expect(listedWhileConnected.statusCode).toBe(200);
      expect(listedWhileConnected.json().items).toEqual([
        expect.objectContaining({
          id: sessionId,
          status: "connected",
          activeRoomIds: ["room-2"]
        })
      ]);

      currentTime = new Date("2026-04-15T13:02:45.000Z");

      const disconnected = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/disconnect",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          sessionId,
          agentId: "agent-openclaw"
        }
      });

      expect(disconnected.statusCode).toBe(200);
      expect(disconnected.json()).toEqual(
        expect.objectContaining({
          id: sessionId,
          status: "disconnected",
          activeRoomIds: ["room-2"],
          lastSeenAt: "2026-04-15T13:02:45.000Z"
        })
      );

      const listedAfterDisconnect = await app.inject({
        method: "GET",
        url: "/api/bridge-sessions"
      });
      expect(listedAfterDisconnect.statusCode).toBe(200);
      expect(listedAfterDisconnect.json().items).toEqual([
        expect.objectContaining({
          id: sessionId,
          status: "disconnected",
          activeRoomIds: ["room-2"]
        })
      ]);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
