import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { parseCodexBridgeCliArgs } from "../src/config";

describe("codex bridge config", () => {
  it("parses session start arguments from an agent invite file", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ma-codex-invite-"));
    const inviteFilePath = join(tempDir, "invite.json");

    try {
      writeFileSync(
        inviteFilePath,
        JSON.stringify({
          type: "multi-agent-room-invite",
          baseUrl: "http://127.0.0.1:5173",
          token: "invite-token",
          primaryRoomId: "room-invite",
          roomIds: ["room-invite"]
        }),
        "utf8"
      );

      const parsed = parseCodexBridgeCliArgs(
        [
          "session",
          "start",
          "--invite-file",
          inviteFilePath,
          "--agent-id",
          "agent-codex-main",
          "--display-name",
          "Codex Main"
        ],
        {
          MA_BRIDGE_SESSION_FILE: "/tmp/codex-session.json"
        },
        "/workspace"
      );

      expect(parsed).toEqual({
        kind: "session.start",
        options: {
          baseUrl: "http://127.0.0.1:5173",
          token: "invite-token",
          agentId: "agent-codex-main",
          displayName: "Codex Main",
          roomId: "room-invite",
          capabilities: ["chat", "code"],
          sessionFilePath: "/tmp/codex-session.json",
          heartbeatMs: 45000
        }
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("parses session start arguments with env fallbacks", () => {
    const parsed = parseCodexBridgeCliArgs(
      ["session", "start", "--room-id", "room-1", "--heartbeat-ms", "30000"],
      {
        MA_BRIDGE_BASE_URL: "http://127.0.0.1:3000",
        MA_BRIDGE_TOKEN: "secret-token",
        MA_BRIDGE_AGENT_ID: "agent-codex-main",
        MA_BRIDGE_DISPLAY_NAME: "Codex",
        MA_BRIDGE_CAPABILITIES: "chat,code",
        MA_BRIDGE_SESSION_FILE: "/tmp/codex-session.json"
      },
      "/workspace"
    );

    expect(parsed).toEqual({
      kind: "session.start",
      options: {
        baseUrl: "http://127.0.0.1:3000",
        token: "secret-token",
        agentId: "agent-codex-main",
        displayName: "Codex",
        roomId: "room-1",
        capabilities: ["chat", "code"],
        sessionFilePath: "/tmp/codex-session.json",
        heartbeatMs: 30000
      }
    });
  });

  it("falls back to default capabilities when none are provided", () => {
    const parsed = parseCodexBridgeCliArgs(
      ["session", "start", "--room-id", "room-1"],
      {
        MA_BRIDGE_BASE_URL: "http://127.0.0.1:3000",
        MA_BRIDGE_TOKEN: "secret-token",
        MA_BRIDGE_AGENT_ID: "agent-codex-main"
      },
      "/workspace"
    );

    expect(parsed).toEqual({
      kind: "session.start",
      options: expect.objectContaining({
        capabilities: ["chat", "code"]
      })
    });
  });

  it("parses events pull arguments", () => {
    const parsed = parseCodexBridgeCliArgs(
      ["events", "pull", "--after-event-id", "evt-1", "--limit", "25"],
      {
        MA_BRIDGE_SESSION_FILE: "/tmp/codex-session.json"
      },
      "/workspace"
    );

    expect(parsed).toEqual({
      kind: "events.pull",
      options: {
        sessionFilePath: "/tmp/codex-session.json",
        afterEventId: "evt-1",
        limit: 25,
        roomId: undefined
      }
    });
  });

  it("parses events watch arguments", () => {
    const parsed = parseCodexBridgeCliArgs(
      [
        "events",
        "watch",
        "--after-event-id",
        "evt-1",
        "--limit",
        "25",
        "--poll-ms",
        "500",
        "--format",
        "transcript"
      ],
      {
        MA_BRIDGE_SESSION_FILE: "/tmp/codex-session.json"
      },
      "/workspace"
    );

    expect(parsed).toEqual({
      kind: "events.watch",
      options: {
        sessionFilePath: "/tmp/codex-session.json",
        afterEventId: "evt-1",
        limit: 25,
        pollMs: 500,
        outputFormat: "transcript",
        roomId: undefined
      }
    });
  });

  it("parses workspace snapshot arguments", () => {
    const parsed = parseCodexBridgeCliArgs(
      ["workspace", "snapshot", "--room-id", "room-2", "--event-limit", "15"],
      {
        MA_BRIDGE_SESSION_FILE: "/tmp/codex-session.json"
      },
      "/workspace"
    );

    expect(parsed).toEqual({
      kind: "workspace.snapshot",
      options: {
        sessionFilePath: "/tmp/codex-session.json",
        roomId: "room-2",
        eventLimit: 15
      }
    });
  });

  it("parses attachment send arguments", () => {
    const parsed = parseCodexBridgeCliArgs(
      ["attachment", "send", "--file", "/tmp/diagram.png", "--caption", "看这个", "--mime-type", "image/png"],
      {
        MA_BRIDGE_SESSION_FILE: "/tmp/codex-session.json"
      },
      "/workspace"
    );

    expect(parsed).toEqual({
      kind: "attachment.send",
      options: {
        sessionFilePath: "/tmp/codex-session.json",
        filePath: "/tmp/diagram.png",
        caption: "看这个",
        mimeType: "image/png"
      }
    });
  });
});
