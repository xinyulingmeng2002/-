import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { cleanupTempDir, createTempDir } from "./helpers";
import { makeMultipartFile, multipartHeaders } from "./multipart";

const roomId = "room-smoke";
const agentId = "agent-generic-smoke";
const displayName = "Generic Smoke Agent";

describe("Phase 1B bridge smoke", () => {
  it("runs the invite-to-room bridge workflow end to end", async () => {
    const tempDir = createTempDir("ma-phase-1b-smoke-");
    const app = buildServer({
      dataDir: tempDir,
      now: () => new Date("2026-05-12T03:00:00.000Z")
    });

    try {
      const tokenCreated = await app.inject({
        method: "POST",
        url: "/api/bridge-tokens",
        payload: {
          label: "Generic smoke bridge",
          bridgeKind: "generic",
          allowedRoomIds: [roomId],
          baseUrl: "http://127.0.0.1:5173"
        }
      });

      expect(tokenCreated.statusCode).toBe(201);
      expect(tokenCreated.json().invite).toEqual(
        expect.objectContaining({
          type: "multi-agent-room-invite",
          bridgeKind: "generic",
          primaryRoomId: roomId,
          roomIds: [roomId],
          token: expect.any(String)
        })
      );
      const token = tokenCreated.json().token as string;

      const connected = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/connect",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          agentId,
          displayName,
          capabilities: ["chat", "analysis"]
        }
      });

      expect(connected.statusCode).toBe(201);
      const sessionId = connected.json().session.id as string;

      const joined = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/join-room",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          sessionId,
          agentId,
          roomId,
          displayName,
          capabilities: ["chat", "analysis"]
        }
      });

      expect(joined.statusCode).toBe(200);
      expect(joined.json()).toEqual(
        expect.objectContaining({
          id: sessionId,
          activeRoomIds: [roomId]
        })
      );

      const humanMessage = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId,
          speakerParticipantId: "human-1",
          body: "请进入房间并同步上下文"
        }
      });

      expect(humanMessage.statusCode).toBe(201);
      const firstEventId = humanMessage.json().eventId as string;

      const events = await app.inject({
        method: "GET",
        url: `/api/bridge/egress/events?agentId=${agentId}&sessionId=${sessionId}&roomId=${roomId}&limit=20`,
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(events.statusCode).toBe(200);
      expect(events.json()).toEqual(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              eventId: firstEventId,
              kind: "message.created",
              roomId
            })
          ],
          nextCursor: firstEventId
        })
      );

      const workspace = await app.inject({
        method: "GET",
        url: `/api/bridge/egress/workspace?agentId=${agentId}&sessionId=${sessionId}&roomId=${roomId}&eventLimit=20`,
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(workspace.statusCode).toBe(200);
      expect(workspace.json()).toEqual(
        expect.objectContaining({
          agent: expect.objectContaining({ id: agentId }),
          session: expect.objectContaining({ id: sessionId }),
          room: { id: roomId },
          recentEvents: expect.arrayContaining([
            expect.objectContaining({
              eventId: firstEventId
            })
          ])
        })
      );

      const uploaded = await app.inject({
        method: "POST",
        url: "/api/uploads",
        payload: makeMultipartFile("smoke.png", "image/png", Buffer.from("89504E470D0A1A0A", "hex")),
        headers: multipartHeaders
      });

      expect(uploaded.statusCode).toBe(201);

      const bridgeMessage = await app.inject({
        method: "POST",
        url: "/api/bridge/ingress/message",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          sessionId,
          agentId,
          roomId,
          body: "Generic smoke agent 已接入并上传附件",
          attachments: [uploaded.json().attachment]
        }
      });

      expect(bridgeMessage.statusCode).toBe(201);
      expect(bridgeMessage.json().payload).toEqual(
        expect.objectContaining({
          speakerParticipantId: agentId,
          attachments: [
            expect.objectContaining({
              name: "smoke.png",
              messageId: expect.any(String)
            })
          ]
        })
      );

      const privateMemory = await app.inject({
        method: "POST",
        url: "/api/private-memories",
        payload: {
          agentId,
          roomId,
          memoryType: "insight",
          title: "Smoke decision",
          body: "The bridge workflow can be used for first real collaboration trials.",
          tags: ["smoke", "bridge"],
          confidence: 0.9,
          sourceEventIds: [bridgeMessage.json().eventId]
        }
      });

      expect(privateMemory.statusCode).toBe(201);
      const memoryId = privateMemory.json().memoryId as string;

      const candidate = await app.inject({
        method: "POST",
        url: `/api/private-memories/${memoryId}/share-candidate`,
        payload: {
          agentId,
          candidateType: "decision"
        }
      });

      expect(candidate.statusCode).toBe(201);
      const candidateId = candidate.json().candidateId as string;

      const accepted = await app.inject({
        method: "POST",
        url: `/api/memory-candidates/${candidateId}/accept`,
        payload: {
          reviewedBy: "human-1"
        }
      });

      expect(accepted.statusCode).toBe(200);
      expect(accepted.json()).toEqual(
        expect.objectContaining({
          status: "accepted",
          reviewedBy: "human-1"
        })
      );

      const sharedKnowledge = await app.inject({
        method: "GET",
        url: `/api/shared-knowledge?roomId=${roomId}`
      });

      expect(sharedKnowledge.statusCode).toBe(200);
      expect(sharedKnowledge.json().items).toEqual([
        expect.objectContaining({
          roomId,
          title: "Smoke decision"
        })
      ]);

      const ownerDisconnect = await app.inject({
        method: "POST",
        url: `/api/bridge-sessions/${sessionId}/disconnect`
      });

      expect(ownerDisconnect.statusCode).toBe(200);
      expect(ownerDisconnect.json()).toEqual(
        expect.objectContaining({
          id: sessionId,
          status: "disconnected",
          activeRoomIds: [roomId]
        })
      );
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  }, 15_000);
});
