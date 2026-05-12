import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildServer } from "../src/app";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("bridge sessions api", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists sessions with status derived from expiration time instead of stored status", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:05:00.000Z"));

    const tempDir = createTempDir();
    const dbDir = join(tempDir, "data", "db");

    mkdirSync(dbDir, { recursive: true });
    writeFileSync(
      join(dbDir, "bridge-sessions.json"),
      JSON.stringify(
        {
          items: [
            {
              id: "session-fresh",
              tokenId: "token-1",
              agentId: "agent-codex",
              status: "disconnected",
              activeRoomIds: ["room-1"],
              connectedAt: "2026-04-15T00:00:00.000Z",
              lastSeenAt: "2026-04-15T00:04:00.000Z",
              expiresAt: "2026-04-15T00:06:00.000Z"
            },
            {
              id: "session-expired",
              tokenId: "token-2",
              agentId: "agent-openclaw",
              status: "connected",
              activeRoomIds: [],
              connectedAt: "2026-04-15T00:00:00.000Z",
              lastSeenAt: "2026-04-15T00:01:00.000Z",
              expiresAt: "2026-04-15T00:04:59.000Z"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const app = buildServer({ dataDir: tempDir });

    try {
      const response = await app.inject({ method: "GET", url: "/api/bridge-sessions" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [
          {
            id: "session-fresh",
            tokenId: "token-1",
            agentId: "agent-codex",
            status: "connected",
            activeRoomIds: ["room-1"],
            connectedAt: "2026-04-15T00:00:00.000Z",
            lastSeenAt: "2026-04-15T00:04:00.000Z",
            expiresAt: "2026-04-15T00:06:00.000Z",
            health: {
              state: "online",
              reason: "heartbeat_fresh",
              lastSeenSecondsAgo: 60,
              expiresInSeconds: 60
            }
          },
          {
            id: "session-expired",
            tokenId: "token-2",
            agentId: "agent-openclaw",
            status: "disconnected",
            activeRoomIds: [],
            connectedAt: "2026-04-15T00:00:00.000Z",
            lastSeenAt: "2026-04-15T00:01:00.000Z",
            expiresAt: "2026-04-15T00:04:59.000Z",
            health: {
              state: "offline",
              reason: "heartbeat_expired",
              lastSeenSecondsAgo: 240,
              expiresInSeconds: -1
            }
          }
        ]
      });
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("disconnects a bridge session by id for room owner controls", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:05:00.000Z"));

    const tempDir = createTempDir();
    const dbDir = join(tempDir, "data", "db");

    mkdirSync(dbDir, { recursive: true });
    writeFileSync(
      join(dbDir, "bridge-sessions.json"),
      JSON.stringify(
        {
          items: [
            {
              id: "session-fresh",
              tokenId: "token-1",
              agentId: "agent-codex",
              status: "connected",
              activeRoomIds: ["room-1"],
              connectedAt: "2026-04-15T00:00:00.000Z",
              lastSeenAt: "2026-04-15T00:04:00.000Z",
              expiresAt: "2026-04-15T00:06:00.000Z"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const app = buildServer({ dataDir: tempDir });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/bridge-sessions/session-fresh/disconnect"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        id: "session-fresh",
        tokenId: "token-1",
        agentId: "agent-codex",
        status: "disconnected",
        activeRoomIds: ["room-1"],
        connectedAt: "2026-04-15T00:00:00.000Z",
        lastSeenAt: "2026-04-15T00:05:00.000Z",
        expiresAt: "2026-04-15T00:05:00.000Z"
      });
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
