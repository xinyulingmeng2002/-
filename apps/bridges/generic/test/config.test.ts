import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseGenericBridgeCliArgs } from "../src/config";

describe("generic bridge config", () => {
  it("parses session start arguments from an agent invite file", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ma-generic-invite-"));
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

      const parsed = parseGenericBridgeCliArgs(
        [
          "session",
          "start",
          "--invite-file",
          inviteFilePath,
          "--agent-id",
          "agent-generic-main",
          "--display-name",
          "Generic Agent",
          "--capabilities",
          "chat,analysis"
        ],
        {
          MA_BRIDGE_SESSION_FILE: "/tmp/generic-session.json"
        },
        "/workspace"
      );

      expect(parsed).toEqual({
        kind: "session.start",
        options: {
          baseUrl: "http://127.0.0.1:5173",
          token: "invite-token",
          agentId: "agent-generic-main",
          displayName: "Generic Agent",
          roomId: "room-invite",
          capabilities: ["chat", "analysis"],
          sessionFilePath: "/tmp/generic-session.json",
          heartbeatMs: 45000
        }
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("requires an explicit agent identity even when invite provides room access", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ma-generic-invite-"));
    const inviteFilePath = join(tempDir, "invite.json");

    try {
      writeFileSync(
        inviteFilePath,
        JSON.stringify({
          type: "multi-agent-room-invite",
          baseUrl: "http://127.0.0.1:5173",
          token: "invite-token",
          primaryRoomId: "room-invite"
        }),
        "utf8"
      );

      expect(() =>
        parseGenericBridgeCliArgs(
          ["session", "start", "--invite-file", inviteFilePath],
          {},
          "/workspace"
        )
      ).toThrow("generic_bridge_missing_agent_id");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("parses message send arguments", () => {
    expect(
      parseGenericBridgeCliArgs(
        ["message", "send", "--body", "hello"],
        { MA_BRIDGE_SESSION_FILE: "/tmp/generic-session.json" },
        "/workspace"
      )
    ).toEqual({
      kind: "message.send",
      options: {
        sessionFilePath: "/tmp/generic-session.json",
        body: "hello"
      }
    });
  });

  it("parses workspace snapshot arguments", () => {
    expect(
      parseGenericBridgeCliArgs(
        ["workspace", "snapshot", "--event-limit", "12"],
        { MA_BRIDGE_SESSION_FILE: "/tmp/generic-session.json" },
        "/workspace"
      )
    ).toEqual({
      kind: "workspace.snapshot",
      options: {
        sessionFilePath: "/tmp/generic-session.json",
        eventLimit: 12
      }
    });
  });

  it("parses event pull arguments", () => {
    expect(
      parseGenericBridgeCliArgs(
        ["events", "pull", "--after-event-id", "evt-1", "--limit", "20"],
        { MA_BRIDGE_SESSION_FILE: "/tmp/generic-session.json" },
        "/workspace"
      )
    ).toEqual({
      kind: "events.pull",
      options: {
        sessionFilePath: "/tmp/generic-session.json",
        afterEventId: "evt-1",
        limit: 20
      }
    });
  });

  it("parses event watch arguments", () => {
    expect(
      parseGenericBridgeCliArgs(
        ["events", "watch", "--after-event-id", "evt-1", "--limit", "20", "--poll-ms", "500"],
        { MA_BRIDGE_SESSION_FILE: "/tmp/generic-session.json" },
        "/workspace"
      )
    ).toEqual({
      kind: "events.watch",
      options: {
        sessionFilePath: "/tmp/generic-session.json",
        afterEventId: "evt-1",
        limit: 20,
        pollMs: 500
      }
    });
  });
});
