import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  getGenericBridgeWorkspaceSnapshot,
  pullGenericBridgeEvents,
  runGenericBridgeSession,
  sendGenericBridgeMessage,
  stopGenericBridgeSession,
  watchGenericBridgeEvents
} from "../src/runtime";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ma-generic-bridge-"));
}

function cleanupTempDir(dirPath: string): void {
  rmSync(dirPath, { recursive: true, force: true });
}

describe("generic bridge runtime", () => {
  it("connects from invite-derived options, joins the target room, and writes a reusable session file", async () => {
    const tempDir = createTempDir();
    const sessionFilePath = join(tempDir, "generic-session.json");
    const client = {
      connect: vi.fn().mockResolvedValue({ session: { id: "session-1" } }),
      joinRoom: vi.fn().mockResolvedValue({ id: "session-1", activeRoomIds: ["room-1"] }),
      heartbeat: vi.fn(),
      disconnect: vi.fn().mockResolvedValue({ id: "session-1", status: "disconnected" }),
      sendMessage: vi.fn(),
      pullEvents: vi.fn(),
      getWorkspaceSnapshot: vi.fn()
    };

    try {
      const handle = await runGenericBridgeSession({
        client,
        baseUrl: "http://127.0.0.1:5173",
        token: "invite-token",
        agentId: "agent-generic-main",
        displayName: "Generic Agent",
        roomId: "room-1",
        capabilities: ["chat"],
        sessionFilePath,
        heartbeatMs: 10_000
      });

      expect(client.connect).toHaveBeenCalledWith({
        agentId: "agent-generic-main",
        displayName: "Generic Agent",
        capabilities: ["chat"]
      });
      expect(client.joinRoom).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-generic-main",
        roomId: "room-1",
        displayName: "Generic Agent",
        capabilities: ["chat"]
      });
      expect(JSON.parse(readFileSync(sessionFilePath, "utf8"))).toEqual({
        baseUrl: "http://127.0.0.1:5173",
        token: "invite-token",
        sessionId: "session-1",
        agentId: "agent-generic-main",
        displayName: "Generic Agent",
        roomId: "room-1",
        capabilities: ["chat"],
        heartbeatMs: 10000
      });

      await handle.shutdown();
      expect(existsSync(sessionFilePath)).toBe(false);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("sends a message through the persisted generic session", async () => {
    const tempDir = createTempDir();
    const sessionFilePath = join(tempDir, "generic-session.json");
    const client = {
      sendMessage: vi.fn().mockResolvedValue({ kind: "message.created", roomId: "room-1" })
    };

    try {
      writeFileSync(
        sessionFilePath,
        JSON.stringify({
          baseUrl: "http://127.0.0.1:5173",
          token: "invite-token",
          sessionId: "session-1",
          agentId: "agent-generic-main",
          displayName: "Generic Agent",
          roomId: "room-1",
          capabilities: ["chat"],
          heartbeatMs: 10000
        }),
        "utf8"
      );

      await sendGenericBridgeMessage({
        client: client as never,
        sessionFilePath,
        body: "hello room"
      });

      expect(client.sendMessage).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-generic-main",
        roomId: "room-1",
        body: "hello room"
      });
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("fetches a workspace snapshot through the persisted generic session", async () => {
    const tempDir = createTempDir();
    const sessionFilePath = join(tempDir, "generic-session.json");
    const client = {
      getWorkspaceSnapshot: vi.fn().mockResolvedValue({ room: { id: "room-1" } })
    };

    try {
      writeFileSync(
        sessionFilePath,
        JSON.stringify({
          baseUrl: "http://127.0.0.1:5173",
          token: "invite-token",
          sessionId: "session-1",
          agentId: "agent-generic-main",
          displayName: "Generic Agent",
          roomId: "room-1",
          capabilities: ["chat"],
          heartbeatMs: 10000
        }),
        "utf8"
      );

      await getGenericBridgeWorkspaceSnapshot({
        client: client as never,
        sessionFilePath,
        eventLimit: 10
      });

      expect(client.getWorkspaceSnapshot).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-generic-main",
        roomId: "room-1",
        eventLimit: 10
      });
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("pulls room events through the persisted generic session", async () => {
    const tempDir = createTempDir();
    const sessionFilePath = join(tempDir, "generic-session.json");
    const client = {
      pullEvents: vi.fn().mockResolvedValue({
        items: [{ eventId: "evt-2", kind: "message.created", roomId: "room-1" }],
        nextCursor: "evt-2"
      })
    };

    try {
      writeFileSync(
        sessionFilePath,
        JSON.stringify({
          baseUrl: "http://127.0.0.1:5173",
          token: "invite-token",
          sessionId: "session-1",
          agentId: "agent-generic-main",
          displayName: "Generic Agent",
          roomId: "room-1",
          capabilities: ["chat"],
          heartbeatMs: 10000
        }),
        "utf8"
      );

      const events = await pullGenericBridgeEvents({
        client: client as never,
        sessionFilePath,
        afterEventId: "evt-1",
        limit: 20
      });

      expect(client.pullEvents).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-generic-main",
        roomId: "room-1",
        afterEventId: "evt-1",
        limit: 20
      });
      expect(events).toEqual({
        items: [{ eventId: "evt-2", kind: "message.created", roomId: "room-1" }],
        nextCursor: "evt-2"
      });
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("watches events and persists the generic cursor for restart", async () => {
    const tempDir = createTempDir();
    const sessionFilePath = join(tempDir, "generic-session.json");
    const abortController = new AbortController();
    const batches: unknown[] = [];
    const client = {
      pullEvents: vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ eventId: "evt-9", kind: "message.created", roomId: "room-1" }],
          nextCursor: "evt-9"
        })
        .mockResolvedValueOnce({
          items: [],
          nextCursor: "evt-10"
        })
    };
    const sleep = vi.fn().mockImplementation(async () => {
      if (client.pullEvents.mock.calls.length >= 2) {
        abortController.abort();
      }
    });

    try {
      writeFileSync(
        sessionFilePath,
        JSON.stringify({
          baseUrl: "http://127.0.0.1:5173",
          token: "invite-token",
          sessionId: "session-1",
          agentId: "agent-generic-main",
          displayName: "Generic Agent",
          roomId: "room-1",
          capabilities: ["chat"],
          heartbeatMs: 10000,
          lastEventId: "evt-8"
        }),
        "utf8"
      );

      await watchGenericBridgeEvents({
        client: client as never,
        sessionFilePath,
        limit: 20,
        pollMs: 10,
        signal: abortController.signal,
        sleep,
        onBatch(batch) {
          batches.push(batch);
        }
      });

      expect(client.pullEvents).toHaveBeenNthCalledWith(1, {
        sessionId: "session-1",
        agentId: "agent-generic-main",
        roomId: "room-1",
        afterEventId: "evt-8",
        limit: 20
      });
      expect(client.pullEvents).toHaveBeenNthCalledWith(2, {
        sessionId: "session-1",
        agentId: "agent-generic-main",
        roomId: "room-1",
        afterEventId: "evt-9",
        limit: 20
      });
      expect(batches).toEqual([
        {
          items: [{ eventId: "evt-9", kind: "message.created", roomId: "room-1" }],
          nextCursor: "evt-9"
        }
      ]);
      const stored = JSON.parse(readFileSync(sessionFilePath, "utf8")) as Record<string, unknown>;
      expect(stored.lastEventId).toBe("evt-10");
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("keeps watching after transient pull failures with backoff", async () => {
    const tempDir = createTempDir();
    const sessionFilePath = join(tempDir, "generic-session.json");
    const abortController = new AbortController();
    const batches: unknown[] = [];
    const client = {
      pullEvents: vi
        .fn()
        .mockRejectedValueOnce(new Error("network down"))
        .mockRejectedValueOnce(new Error("still down"))
        .mockResolvedValueOnce({
          items: [{ eventId: "evt-2", kind: "message.created", roomId: "room-1" }],
          nextCursor: "evt-2"
        })
    };
    const sleep = vi.fn().mockImplementation(async () => {
      if (client.pullEvents.mock.calls.length >= 3) {
        abortController.abort();
      }
    });

    try {
      writeFileSync(
        sessionFilePath,
        JSON.stringify({
          baseUrl: "http://127.0.0.1:5173",
          token: "invite-token",
          sessionId: "session-1",
          agentId: "agent-generic-main",
          displayName: "Generic Agent",
          roomId: "room-1",
          capabilities: ["chat"],
          heartbeatMs: 10000,
          lastEventId: "evt-1"
        }),
        "utf8"
      );

      await watchGenericBridgeEvents({
        client: client as never,
        sessionFilePath,
        limit: 20,
        pollMs: 10,
        signal: abortController.signal,
        sleep,
        onBatch(batch) {
          batches.push(batch);
        }
      });

      expect(client.pullEvents).toHaveBeenCalledTimes(3);
      expect(client.pullEvents).toHaveBeenNthCalledWith(1, {
        sessionId: "session-1",
        agentId: "agent-generic-main",
        roomId: "room-1",
        afterEventId: "evt-1",
        limit: 20
      });
      expect(client.pullEvents).toHaveBeenNthCalledWith(3, {
        sessionId: "session-1",
        agentId: "agent-generic-main",
        roomId: "room-1",
        afterEventId: "evt-1",
        limit: 20
      });
      expect(sleep).toHaveBeenNthCalledWith(1, 10);
      expect(sleep).toHaveBeenNthCalledWith(2, 20);
      expect(sleep).toHaveBeenNthCalledWith(3, 10);
      expect(batches).toEqual([
        {
          items: [{ eventId: "evt-2", kind: "message.created", roomId: "room-1" }],
          nextCursor: "evt-2"
        }
      ]);
      const stored = JSON.parse(readFileSync(sessionFilePath, "utf8")) as Record<string, unknown>;
      expect(stored.lastEventId).toBe("evt-2");
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("reconnects a stale generic session and keeps watching from the persisted cursor", async () => {
    const tempDir = createTempDir();
    const sessionFilePath = join(tempDir, "generic-session.json");
    const abortController = new AbortController();
    const batches: unknown[] = [];
    const client = {
      connect: vi.fn().mockResolvedValue({ session: { id: "session-2" } }),
      joinRoom: vi.fn().mockResolvedValue({ id: "session-2", activeRoomIds: ["room-1"] }),
      pullEvents: vi
        .fn()
        .mockRejectedValueOnce(new Error("bridge_request_failed:404"))
        .mockResolvedValueOnce({
          items: [{ eventId: "evt-2", kind: "message.created", roomId: "room-1" }],
          nextCursor: "evt-2"
        })
    };
    const sleep = vi.fn().mockImplementation(async () => {
      if (client.pullEvents.mock.calls.length >= 2) {
        abortController.abort();
      }
    });

    try {
      writeFileSync(
        sessionFilePath,
        JSON.stringify({
          baseUrl: "http://127.0.0.1:5173",
          token: "invite-token",
          sessionId: "session-1",
          agentId: "agent-generic-main",
          displayName: "Generic Agent",
          roomId: "room-1",
          capabilities: ["chat"],
          heartbeatMs: 10000,
          lastEventId: "evt-1"
        }),
        "utf8"
      );

      await watchGenericBridgeEvents({
        client: client as never,
        sessionFilePath,
        limit: 20,
        pollMs: 10,
        signal: abortController.signal,
        sleep,
        onBatch(batch) {
          batches.push(batch);
        }
      });

      expect(client.connect).toHaveBeenCalledWith({
        agentId: "agent-generic-main",
        displayName: "Generic Agent",
        capabilities: ["chat"]
      });
      expect(client.joinRoom).toHaveBeenCalledWith({
        sessionId: "session-2",
        agentId: "agent-generic-main",
        roomId: "room-1",
        displayName: "Generic Agent",
        capabilities: ["chat"]
      });
      expect(client.pullEvents).toHaveBeenNthCalledWith(1, {
        sessionId: "session-1",
        agentId: "agent-generic-main",
        roomId: "room-1",
        afterEventId: "evt-1",
        limit: 20
      });
      expect(client.pullEvents).toHaveBeenNthCalledWith(2, {
        sessionId: "session-2",
        agentId: "agent-generic-main",
        roomId: "room-1",
        afterEventId: "evt-1",
        limit: 20
      });
      expect(batches).toEqual([
        {
          items: [{ eventId: "evt-2", kind: "message.created", roomId: "room-1" }],
          nextCursor: "evt-2"
        }
      ]);
      const stored = JSON.parse(readFileSync(sessionFilePath, "utf8")) as Record<string, unknown>;
      expect(stored.sessionId).toBe("session-2");
      expect(stored.lastEventId).toBe("evt-2");
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("disconnects and removes the persisted generic session file", async () => {
    const tempDir = createTempDir();
    const sessionFilePath = join(tempDir, "generic-session.json");
    const client = {
      disconnect: vi.fn().mockResolvedValue({ status: "disconnected" })
    };

    try {
      writeFileSync(
        sessionFilePath,
        JSON.stringify({
          baseUrl: "http://127.0.0.1:5173",
          token: "invite-token",
          sessionId: "session-1",
          agentId: "agent-generic-main",
          displayName: "Generic Agent",
          roomId: "room-1",
          capabilities: ["chat"],
          heartbeatMs: 10000
        }),
        "utf8"
      );

      await stopGenericBridgeSession({
        client: client as never,
        sessionFilePath
      });

      expect(client.disconnect).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-generic-main"
      });
      expect(existsSync(sessionFilePath)).toBe(false);
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
