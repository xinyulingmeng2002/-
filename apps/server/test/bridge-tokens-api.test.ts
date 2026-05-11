import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("bridge tokens api", () => {
  it("creates a bridge token and lists it without exposing the secret", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/bridge-tokens",
        payload: {
          label: "Codex bridge",
          bridgeKind: "codex",
          allowedRoomIds: ["room-1"]
        }
      });

      expect(created.statusCode).toBe(201);

      const createdBody = created.json();
      expect(createdBody).toEqual({
        token: expect.any(String),
        invite: {
          type: "multi-agent-room-invite",
          version: "1",
          label: "Codex bridge",
          bridgeKind: "codex",
          roomIds: ["room-1"],
          primaryRoomId: "room-1",
          baseUrl: "http://localhost:80",
          token: expect.any(String),
          endpoints: {
            connect: "/api/bridge/ingress/connect",
            joinRoom: "/api/bridge/ingress/join-room",
            heartbeat: "/api/bridge/ingress/heartbeat",
            disconnect: "/api/bridge/ingress/disconnect",
            pullEvents: "/api/bridge/egress/events",
            workspace: "/api/bridge/egress/workspace",
            sendMessage: "/api/bridge/ingress/message",
            uploadFile: "/api/uploads"
          },
          identityRules: {
            mustDeclareAgentIdentity: true,
            mustNotImpersonateHuman: true,
            bridgeOnlyTransportsMessages: true,
            privateMemoryRequiresReview: true
          },
          ownerControls: {
            canRevokeToken: true,
            canDisconnectSession: true
          }
        },
        metadata: {
          id: expect.any(String),
          label: "Codex bridge",
          bridgeKind: "codex",
          allowedRoomIds: ["room-1"],
          createdAt: expect.any(String),
          revokedAt: null
        }
      });
      expect(createdBody.invite.token).toBe(createdBody.token);

      const listed = await app.inject({ method: "GET", url: "/api/bridge-tokens" });

      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toEqual({
        items: [
          {
            id: createdBody.metadata.id,
            label: "Codex bridge",
            bridgeKind: "codex",
            allowedRoomIds: ["room-1"],
            createdAt: createdBody.metadata.createdAt,
            revokedAt: null
          }
        ]
      });
      expect(listed.json().items[0]).not.toHaveProperty("token");
      expect(listed.json().items[0]).not.toHaveProperty("invite");
      expect(listed.json().items[0]).not.toHaveProperty("secretHash");

      const snapshot = JSON.parse(
        readFileSync(join(tempDir, "data", "db", "bridge-tokens.json"), "utf8")
      ) as {
        items: Array<{ id: string; secretHash?: string; token?: string }>;
      };

      expect(snapshot.items).toHaveLength(1);
      expect(snapshot.items[0]).toEqual(
        expect.objectContaining({
          id: createdBody.metadata.id,
          secretHash: createHash("sha256").update(createdBody.token).digest("hex")
        })
      );
      expect(snapshot.items[0]).not.toHaveProperty("token");
      expect(snapshot.items[0]).not.toHaveProperty("invite");
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("uses an explicit baseUrl when building an agent invite package", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/bridge-tokens",
        payload: {
          label: "Generic guest key",
          bridgeKind: "generic",
          allowedRoomIds: ["room-2", "room-3"],
          baseUrl: "http://127.0.0.1:5173"
        }
      });

      expect(created.statusCode).toBe(201);
      expect(created.json().invite).toEqual(
        expect.objectContaining({
          type: "multi-agent-room-invite",
          label: "Generic guest key",
          bridgeKind: "generic",
          roomIds: ["room-2", "room-3"],
          primaryRoomId: "room-2",
          baseUrl: "http://127.0.0.1:5173",
          token: created.json().token
        })
      );
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("revokes a bridge token without revealing its secret", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/bridge-tokens",
        payload: {
          label: "OpenClaw bridge",
          bridgeKind: "openclaw",
          allowedRoomIds: []
        }
      });
      const tokenId = created.json().metadata.id as string;

      const revoked = await app.inject({
        method: "POST",
        url: `/api/bridge-tokens/${tokenId}/revoke`
      });

      expect(revoked.statusCode).toBe(200);
      expect(revoked.json()).toEqual({
        id: tokenId,
        label: "OpenClaw bridge",
        bridgeKind: "openclaw",
        allowedRoomIds: [],
        createdAt: expect.any(String),
        revokedAt: expect.any(String)
      });
      expect(revoked.json()).not.toHaveProperty("token");
      expect(revoked.json()).not.toHaveProperty("secretHash");

      const listed = await app.inject({ method: "GET", url: "/api/bridge-tokens" });

      expect(listed.statusCode).toBe(200);
      expect(listed.json().items).toEqual([
        expect.objectContaining({
          id: tokenId,
          revokedAt: expect.any(String)
        })
      ]);
      expect(listed.json().items[0]).not.toHaveProperty("token");
      expect(listed.json().items[0]).not.toHaveProperty("secretHash");
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
