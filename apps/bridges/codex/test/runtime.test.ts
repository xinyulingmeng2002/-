import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  sendCodexBridgeAttachment,
  getCodexBridgeWorkspaceSnapshot,
  pullCodexBridgeEvents,
  runCodexBridgeSession,
  sendCodexBridgeMessage,
  stopCodexBridgeSession,
  watchCodexBridgeEvents
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
      sendMessage: vi.fn(),
      pullEvents: vi.fn(),
      getWorkspaceSnapshot: vi.fn(),
      uploadFile: vi.fn()
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
      sendMessage: vi.fn(),
      pullEvents: vi.fn(),
      getWorkspaceSnapshot: vi.fn(),
      uploadFile: vi.fn()
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
      sendMessage: vi.fn(),
      pullEvents: vi.fn(),
      getWorkspaceSnapshot: vi.fn(),
      uploadFile: vi.fn()
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

  it("uploads a local file and sends it as a formal attachment message", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const filePath = join(tempDir, "diagram.png");
    const client = {
      uploadFile: vi.fn().mockResolvedValue({
        attachment: {
          id: "att-1",
          messageId: "",
          kind: "image",
          url: "http://127.0.0.1:3000/uploads/2026/04/att-1-diagram.png",
          name: "diagram.png",
          mimeType: "image/png",
          sizeBytes: 4
        },
        originalName: "diagram.png",
        mimeType: "image/png",
        sizeBytes: 4
      }),
      sendMessage: vi.fn().mockResolvedValue({
        kind: "message.created",
        roomId: "room-1"
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
      writeFileSync(filePath, Buffer.from([1, 2, 3, 4]));

      const result = await sendCodexBridgeAttachment({
        client: client as never,
        sessionFilePath,
        filePath,
        caption: "看这个"
      });

      expect(client.uploadFile).toHaveBeenCalledWith({
        fileName: "diagram.png",
        mimeType: undefined,
        content: expect.any(Uint8Array)
      });
      expect(client.sendMessage).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-codex-main",
        roomId: "room-1",
        body: "看这个",
        attachments: [
          {
            id: "att-1",
            messageId: "",
            kind: "image",
            url: "http://127.0.0.1:3000/uploads/2026/04/att-1-diagram.png",
            name: "diagram.png",
            mimeType: "image/png",
            sizeBytes: 4
          }
        ]
      });
      expect(result).toEqual({
        attachment: {
          id: "att-1",
          messageId: "",
          kind: "image",
          url: "http://127.0.0.1:3000/uploads/2026/04/att-1-diagram.png",
          name: "diagram.png",
          mimeType: "image/png",
          sizeBytes: 4
        },
        originalName: "diagram.png",
        mimeType: "image/png",
        sizeBytes: 4
      });
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("reads the persisted session file and pulls room events", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const client = {
      pullEvents: vi.fn().mockResolvedValue({
        items: [{ eventId: "evt-2", kind: "message.created", roomId: "room-1" }],
        nextCursor: "evt-2"
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

      const pulled = await pullCodexBridgeEvents({
        client: client as never,
        sessionFilePath,
        afterEventId: "evt-1",
        limit: 20
      });

      expect(client.pullEvents).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-codex-main",
        roomId: "room-1",
        afterEventId: "evt-1",
        limit: 20
      });
      expect(pulled).toEqual({
        items: [{ eventId: "evt-2", kind: "message.created", roomId: "room-1" }],
        nextCursor: "evt-2"
      });
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("reads the persisted session file and fetches a workspace snapshot", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const client = {
      getWorkspaceSnapshot: vi.fn().mockResolvedValue({
        room: { id: "room-2" },
        recentEvents: [{ eventId: "evt-2", kind: "message.created", roomId: "room-2" }]
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

      const snapshot = await getCodexBridgeWorkspaceSnapshot({
        client: client as never,
        sessionFilePath,
        roomId: "room-2",
        eventLimit: 15
      });

      expect(client.getWorkspaceSnapshot).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-codex-main",
        roomId: "room-2",
        eventLimit: 15
      });
      expect(snapshot).toEqual({
        room: { id: "room-2" },
        recentEvents: [{ eventId: "evt-2", kind: "message.created", roomId: "room-2" }]
      });
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("watches room events with cursor advancement", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const abortController = new AbortController();
    const batches: unknown[] = [];
    const client = {
      pullEvents: vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ eventId: "evt-2", kind: "message.created", roomId: "room-1" }],
          nextCursor: "evt-2"
        })
        .mockResolvedValueOnce({
          items: [],
          nextCursor: "evt-2"
        })
    };
    const sleep = vi.fn().mockImplementation(async () => {
      if (client.pullEvents.mock.calls.length >= 2) {
        abortController.abort();
      }
    });

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

      await watchCodexBridgeEvents({
        client: client as never,
        sessionFilePath,
        afterEventId: "evt-1",
        limit: 20,
        pollMs: 1,
        signal: abortController.signal,
        onBatch(batch) {
          batches.push(batch);
        },
        sleep
      });

      expect(client.pullEvents).toHaveBeenNthCalledWith(1, {
        sessionId: "session-1",
        agentId: "agent-codex-main",
        roomId: "room-1",
        afterEventId: "evt-1",
        limit: 20
      });
      expect(client.pullEvents).toHaveBeenNthCalledWith(2, {
        sessionId: "session-1",
        agentId: "agent-codex-main",
        roomId: "room-1",
        afterEventId: "evt-2",
        limit: 20
      });
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

  it("marks watched events that mention or reply to the current agent", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const abortController = new AbortController();
    const batches: unknown[] = [];
    const client = {
      pullEvents: vi.fn().mockResolvedValue({
        items: [
          {
            eventId: "evt-mentioned",
            kind: "message.created",
            roomId: "room-1",
            payload: {
              body: "@Codex 你怎么看？",
              speakerParticipantId: "human-1"
            }
          },
          {
            eventId: "evt-reply",
            kind: "message.created",
            roomId: "room-1",
            payload: {
              body: "> 回复 agent-codex-main: 刚才那句\n\n我补充一下。",
              speakerParticipantId: "human-1"
            }
          }
        ],
        nextCursor: "evt-reply"
      })
    };
    const sleep = vi.fn().mockImplementation(async () => {
      abortController.abort();
    });

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

      await watchCodexBridgeEvents({
        client: client as never,
        sessionFilePath,
        limit: 20,
        pollMs: 1,
        signal: abortController.signal,
        onBatch(batch) {
          batches.push(batch);
        },
        sleep
      });

      expect(batches).toEqual([
        {
          items: [
            expect.objectContaining({
              eventId: "evt-mentioned",
              attentionTags: ["mentioned-you"]
            }),
            expect.objectContaining({
              eventId: "evt-reply",
              attentionTags: ["reply-to-you"]
            })
          ],
          nextCursor: "evt-reply"
        }
      ]);
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("resumes event watching from the persisted cursor", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const abortController = new AbortController();
    const client = {
      pullEvents: vi.fn().mockResolvedValue({
        items: [],
        nextCursor: "evt-9"
      })
    };
    const sleep = vi.fn().mockImplementation(async () => {
      abortController.abort();
    });

    try {
      const session = {
        baseUrl: "http://127.0.0.1:3000",
        token: "secret-token",
        sessionId: "session-1",
        agentId: "agent-codex-main",
        displayName: "Codex",
        roomId: "room-1",
        capabilities: ["chat"],
        heartbeatMs: 1000,
        lastEventId: "evt-8"
      };
      writeFileSync(sessionFilePath, JSON.stringify(session, null, 2), "utf8");

      await watchCodexBridgeEvents({
        client: client as never,
        sessionFilePath,
        limit: 20,
        pollMs: 1,
        signal: abortController.signal,
        sleep
      });

      expect(client.pullEvents).toHaveBeenCalledWith({
        sessionId: "session-1",
        agentId: "agent-codex-main",
        roomId: "room-1",
        afterEventId: "evt-8",
        limit: 20
      });
      const stored = JSON.parse(readFileSync(sessionFilePath, "utf8")) as Record<string, unknown>;
      expect(stored.lastEventId).toBe("evt-9");
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it("keeps watching after transient pull failures with backoff", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
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
      const session = {
        baseUrl: "http://127.0.0.1:3000",
        token: "secret-token",
        sessionId: "session-1",
        agentId: "agent-codex-main",
        displayName: "Codex",
        roomId: "room-1",
        capabilities: ["chat"],
        heartbeatMs: 1000,
        lastEventId: "evt-1"
      };
      writeFileSync(sessionFilePath, JSON.stringify(session, null, 2), "utf8");

      await watchCodexBridgeEvents({
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
        agentId: "agent-codex-main",
        roomId: "room-1",
        afterEventId: "evt-1",
        limit: 20
      });
      expect(client.pullEvents).toHaveBeenNthCalledWith(3, {
        sessionId: "session-1",
        agentId: "agent-codex-main",
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

  it("reconnects a stale codex session and keeps watching from the persisted cursor", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
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
      const session = {
        baseUrl: "http://127.0.0.1:3000",
        token: "secret-token",
        sessionId: "session-1",
        agentId: "agent-codex-main",
        displayName: "Codex",
        roomId: "room-1",
        capabilities: ["chat"],
        heartbeatMs: 1000,
        lastEventId: "evt-1"
      };
      writeFileSync(sessionFilePath, JSON.stringify(session, null, 2), "utf8");

      await watchCodexBridgeEvents({
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
        agentId: "agent-codex-main",
        displayName: "Codex",
        capabilities: ["chat"]
      });
      expect(client.joinRoom).toHaveBeenCalledWith({
        sessionId: "session-2",
        agentId: "agent-codex-main",
        roomId: "room-1",
        displayName: "Codex",
        capabilities: ["chat"]
      });
      expect(client.pullEvents).toHaveBeenNthCalledWith(2, {
        sessionId: "session-2",
        agentId: "agent-codex-main",
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

  it("keeps the session file when live shutdown disconnect fails", async () => {
    const tempDir = createTempDir("ma-codex-bridge-");
    const sessionFilePath = join(tempDir, "codex-session.json");
    const client = {
      connect: vi.fn().mockResolvedValue({ session: { id: "session-1" } }),
      joinRoom: vi.fn().mockResolvedValue({ id: "session-1", activeRoomIds: ["room-1"] }),
      heartbeat: vi.fn().mockResolvedValue({ id: "session-1", status: "connected" }),
      disconnect: vi.fn().mockRejectedValue(new Error("disconnect failed")),
      sendMessage: vi.fn(),
      pullEvents: vi.fn(),
      getWorkspaceSnapshot: vi.fn(),
      uploadFile: vi.fn()
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
