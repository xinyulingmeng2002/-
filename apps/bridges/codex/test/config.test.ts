import { describe, expect, it } from "vitest";

import { parseCodexBridgeCliArgs } from "../src/config";

describe("codex bridge config", () => {
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
