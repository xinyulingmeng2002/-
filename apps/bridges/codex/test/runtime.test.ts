import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  runCodexBridgeSession,
  sendCodexBridgeMessage,
  stopCodexBridgeSession
} from "../src/runtime";

function createTempDir(prefix = "ma-codex-bridge-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function cleanupTempDir(dirPath: string): void {
  rmSync(dirPath, { recursive: true, force: true });
}

describe("codex bridge runtime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("connects, joins the target room, and writes a reusable session file", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const client = {
      connect: vi.fn().mockResolvedValue({
        participant: {
          id: "agent-codex-main",
          displayName: "Codex",
          bridgeKind: "codex"
        },
        session: {
          id: "session-1"
        }
      }),
      joinRoom: vi.fn().mockResolvedValue({
        id: "session-1",
        activeRoomIds: ["room-1"]
      }),
      heartbeat: vi.fn().mockResolvedValue({ id: "session-1", status: "connected" }),
      disconnect: vi.fn().mockResolvedValue({ id: "session-1", status: "disconnected" }),
      sendMessage: vi.fn()
    } as const;

    try {
      const handle = await runCodexBridgeSession({
        client,
        baseUrl: "http://127.0.0.1:3000",
        token: "secret-token",
        agentId: "agent-codex-main",
        displayName: "Codex",
        roomId: "room-1",
        capabilities: ["chat", "code"],
        sessionFilePath,
        heartbeatMs: 5_000
      });

      expect(client.connect).toHaveBeenCalledWith({
        agentId: "agent-codex-main",
        displayName: "Codex",
        capabilities: ["chat", "code"]
      });
      expect(client.joinRoom).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-codex-main",
        roomId: "room-1",
        displayName: "Codex",
        capabilities: ["chat", "code"]
      });

      const stored = JSON.parse(readFileSync(sessionFilePath, "utf8")) as Record<string, unknown>;
      expect(stored).toEqual({
        baseUrl: "http://127.0.0.1:3000",
        token: "secret-token",
        sessionId: "session-1",
        agentId: "agent-codex-main",
        displayName: "Codex",
        roomId: "room-1",
        capabilities: ["chat", "code"],
        heartbeatMs: 5000
      });

      await handle.shutdown();
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("disconnects the remote session if joinRoom fails before persistence", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const client = {
      connect: vi.fn().mockResolvedValue({ session: { id: "session-1" } }),
      joinRoom: vi.fn().mockRejectedValue(new Error("join failed")),
      heartbeat: vi.fn(),
      disconnect: vi.fn().mockResolvedValue({ id: "session-1", status: "disconnected" }),
      sendMessage: vi.fn()
    } as const;

    try {
      await expect(
        runCodexBridgeSession({
          client,
          baseUrl: "http://127.0.0.1:3000",
          token: "secret-token",
          agentId: "agent-codex-main",
          displayName: "Codex",
          roomId: "room-1",
          sessionFilePath,
          heartbeatMs: 1_000
        })
      ).rejects.toThrow("join failed");

      expect(client.disconnect).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-codex-main"
      });
      expect(existsSync(sessionFilePath)).toBe(false);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("keeps the bridge session alive with periodic heartbeats", async () => {
    vi.useFakeTimers();

    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const client = {
      connect: vi.fn().mockResolvedValue({ session: { id: "session-1" } }),
      joinRoom: vi.fn().mockResolvedValue({ id: "session-1", activeRoomIds: ["room-1"] }),
      heartbeat: vi.fn().mockResolvedValue({ id: "session-1", status: "connected" }),
      disconnect: vi.fn().mockResolvedValue({ id: "session-1", status: "disconnected" }),
      sendMessage: vi.fn()
    } as const;

    try {
      const handle = await runCodexBridgeSession({
        client,
        baseUrl: "http://127.0.0.1:3000",
        token: "secret-token",
        agentId: "agent-codex-main",
        displayName: "Codex",
        roomId: "room-1",
        sessionFilePath,
        heartbeatMs: 1_000
      });

      await vi.advanceTimersByTimeAsync(2_500);

      expect(client.heartbeat).toHaveBeenCalledTimes(2);
      expect(client.heartbeat).toHaveBeenNthCalledWith(1, {
        sessionId: "session-1",
        agentId: "agent-codex-main"
      });

      await handle.shutdown();
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("reads the persisted session file and sends a room message", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const client = {
      sendMessage: vi.fn().mockResolvedValue({
        kind: "message.created",
        roomId: "room-1",
        payload: {
          body: "Bridge says hello"
        }
      })
    };

    try {
      const session = {
        baseUrl: "http://127.0.0.1:3000",
        token: "secret-token",
        sessionId: "session-1",
        agentId: "agent-codex-main",
        displayName: "Codex",
        roomId: "room-1",
        capabilities: ["chat"],
        heartbeatMs: 1000
      };
      writeFileSync(sessionFilePath, JSON.stringify(session, null, 2), "utf8");

      const sent = await sendCodexBridgeMessage({
        client: client as never,
        sessionFilePath,
        body: "Bridge says hello"
      });

      expect(client.sendMessage).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-codex-main",
        roomId: "room-1",
        body: "Bridge says hello"
      });
      expect(sent).toEqual(
        expect.objectContaining({
          roomId: "room-1"
        })
      );
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("keeps the session file when live shutdown disconnect fails", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const client = {
      connect: vi.fn().mockResolvedValue({ session: { id: "session-1" } }),
      joinRoom: vi.fn().mockResolvedValue({ id: "session-1", activeRoomIds: ["room-1"] }),
      heartbeat: vi.fn().mockResolvedValue({ id: "session-1", status: "connected" }),
      disconnect: vi.fn().mockRejectedValue(new Error("disconnect failed")),
      sendMessage: vi.fn()
    } as const;

    try {
      const handle = await runCodexBridgeSession({
        client,
        baseUrl: "http://127.0.0.1:3000",
        token: "secret-token",
        agentId: "agent-codex-main",
        displayName: "Codex",
        roomId: "room-1",
        sessionFilePath,
        heartbeatMs: 1_000
      });

      await expect(handle.shutdown()).rejects.toThrow("disconnect failed");
      expect(existsSync(sessionFilePath)).toBe(true);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("disconnects and removes the persisted session file", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const client = {
      disconnect: vi.fn().mockResolvedValue({
        id: "session-1",
        status: "disconnected"
      })
    };

    try {
      const session = {
        baseUrl: "http://127.0.0.1:3000",
        token: "secret-token",
        sessionId: "session-1",
        agentId: "agent-codex-main",
        displayName: "Codex",
        roomId: "room-1",
        capabilities: ["chat"],
        heartbeatMs: 1000
      };
      writeFileSync(sessionFilePath, JSON.stringify(session, null, 2), "utf8");

      const result = await stopCodexBridgeSession({
        client: client as never,
        sessionFilePath
      });

      expect(client.disconnect).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-codex-main"
      });
      expect(result).toEqual(
        expect.objectContaining({
          status: "disconnected"
        })
      );
      expect(existsSync(sessionFilePath)).toBe(false);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("keeps the persisted session file when stop disconnect fails", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const client = {
      disconnect: vi.fn().mockRejectedValue(new Error("disconnect failed"))
    };

    try {
      const session = {
        baseUrl: "http://127.0.0.1:3000",
        token: "secret-token",
        sessionId: "session-1",
        agentId: "agent-codex-main",
        displayName: "Codex",
        roomId: "room-1",
        capabilities: ["chat"],
        heartbeatMs: 1000
      };
      writeFileSync(sessionFilePath, JSON.stringify(session, null, 2), "utf8");

      await expect(
        stopCodexBridgeSession({
          client: client as never,
          sessionFilePath
        })
      ).rejects.toThrow("disconnect failed");

      expect(existsSync(sessionFilePath)).toBe(true);
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
