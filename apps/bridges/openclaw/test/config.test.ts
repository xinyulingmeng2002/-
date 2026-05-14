import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { parseOpenClawBridgeCliArgs } from "../src/config";

describe("openclaw bridge config", () => {
  it("parses session start arguments from an agent invite file", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ma-openclaw-invite-"));
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

      const parsed = parseOpenClawBridgeCliArgs(
        [
          "session",
          "start",
          "--invite-file",
          inviteFilePath,
          "--agent-id",
          "agent-openclaw-main",
          "--display-name",
          "OpenClaw Main"
        ],
        {
          MA_BRIDGE_SESSION_FILE: "/tmp/openclaw-session.json"
        },
        "/workspace"
      );

      expect(parsed).toEqual({
        kind: "session.start",
        options: {
          baseUrl: "http://127.0.0.1:5173",
          token: "invite-token",
          agentId: "agent-openclaw-main",
          displayName: "OpenClaw Main",
          roomId: "room-invite",
          capabilities: ["chat", "tools"],
          sessionFilePath: "/tmp/openclaw-session.json",
          heartbeatMs: 45000
        }
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("parses session start arguments with env fallbacks", () => {
    const parsed = parseOpenClawBridgeCliArgs(
      ["session", "start", "--room-id", "room-1", "--heartbeat-ms", "30000"],
      {
        MA_BRIDGE_BASE_URL: "http://127.0.0.1:3000",
        MA_BRIDGE_TOKEN: "secret-token",
        MA_BRIDGE_AGENT_ID: "agent-openclaw-main",
        MA_BRIDGE_DISPLAY_NAME: "OpenClaw",
        MA_BRIDGE_CAPABILITIES: "chat,tools",
        MA_BRIDGE_SESSION_FILE: "/tmp/openclaw-session.json"
      },
      "/workspace"
    );

    expect(parsed).toEqual({
      kind: "session.start",
      options: {
        baseUrl: "http://127.0.0.1:3000",
        token: "secret-token",
        agentId: "agent-openclaw-main",
        displayName: "OpenClaw",
        roomId: "room-1",
        capabilities: ["chat", "tools"],
        sessionFilePath: "/tmp/openclaw-session.json",
        heartbeatMs: 30000
      }
    });
  });

  it("falls back to default capabilities when none are provided", () => {
    const parsed = parseOpenClawBridgeCliArgs(
      ["session", "start", "--room-id", "room-1"],
      {
        MA_BRIDGE_BASE_URL: "http://127.0.0.1:3000",
        MA_BRIDGE_TOKEN: "secret-token",
        MA_BRIDGE_AGENT_ID: "agent-openclaw-main"
      },
      "/workspace"
    );

    expect(parsed).toEqual({
      kind: "session.start",
      options: expect.objectContaining({
        capabilities: ["chat", "tools"]
      })
    });
  });

  it("parses events pull arguments", () => {
    const parsed = parseOpenClawBridgeCliArgs(
      ["events", "pull", "--after-event-id", "evt-1", "--limit", "25"],
      {
        MA_BRIDGE_SESSION_FILE: "/tmp/openclaw-session.json"
      },
      "/workspace"
    );

    expect(parsed).toEqual({
      kind: "events.pull",
      options: {
        sessionFilePath: "/tmp/openclaw-session.json",
        afterEventId: "evt-1",
        limit: 25,
        roomId: undefined
      }
    });
  });

  it("parses events watch arguments", () => {
    const parsed = parseOpenClawBridgeCliArgs(
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
        MA_BRIDGE_SESSION_FILE: "/tmp/openclaw-session.json"
      },
      "/workspace"
    );

    expect(parsed).toEqual({
      kind: "events.watch",
      options: {
        sessionFilePath: "/tmp/openclaw-session.json",
        afterEventId: "evt-1",
        limit: 25,
        pollMs: 500,
        outputFormat: "transcript",
        roomId: undefined
      }
    });
  });

  it("parses workspace snapshot arguments", () => {
    const parsed = parseOpenClawBridgeCliArgs(
      ["workspace", "snapshot", "--room-id", "room-2", "--event-limit", "15"],
      {
        MA_BRIDGE_SESSION_FILE: "/tmp/openclaw-session.json"
      },
      "/workspace"
    );

    expect(parsed).toEqual({
      kind: "workspace.snapshot",
      options: {
        sessionFilePath: "/tmp/openclaw-session.json",
        roomId: "room-2",
        eventLimit: 15
      }
    });
  });

  it("parses attachment send arguments", () => {
    const parsed = parseOpenClawBridgeCliArgs(
      ["attachment", "send", "--file", "/tmp/diagram.png", "--caption", "看这个", "--mime-type", "image/png"],
      {
        MA_BRIDGE_SESSION_FILE: "/tmp/openclaw-session.json"
      },
      "/workspace"
    );

    expect(parsed).toEqual({
      kind: "attachment.send",
      options: {
        sessionFilePath: "/tmp/openclaw-session.json",
        filePath: "/tmp/diagram.png",
        caption: "看这个",
        mimeType: "image/png"
      }
    });
  });
});
