import { describe, expect, it } from "vitest";

import { parseOpenClawBridgeCliArgs } from "../src/config";

describe("openclaw bridge config", () => {
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
      ["events", "watch", "--after-event-id", "evt-1", "--limit", "25", "--poll-ms", "500"],
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
