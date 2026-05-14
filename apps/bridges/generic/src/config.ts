import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type EnvLike = Record<string, string | undefined>;

const DEFAULT_HEARTBEAT_MS = 45_000;
const DEFAULT_POLL_MS = 2_000;

type WatchOutputFormat = "json" | "transcript";

type StartOptions = {
  baseUrl: string;
  token: string;
  agentId: string;
  displayName: string;
  roomId: string;
  capabilities: string[];
  sessionFilePath: string;
  heartbeatMs: number;
};

export type GenericBridgeCliCommand =
  | {
      kind: "session.start";
      options: StartOptions;
    }
  | {
      kind: "session.stop";
      options: {
        sessionFilePath: string;
      };
    }
  | {
      kind: "message.send";
      options: {
        sessionFilePath: string;
        body?: string;
      };
    }
  | {
      kind: "workspace.snapshot";
      options: {
        sessionFilePath: string;
        eventLimit?: number;
      };
    }
  | {
      kind: "events.pull";
      options: {
        sessionFilePath: string;
        afterEventId?: string;
        limit?: number;
      };
    }
  | {
      kind: "events.watch";
      options: {
        sessionFilePath: string;
        afterEventId?: string;
        limit?: number;
        pollMs: number;
        outputFormat: WatchOutputFormat;
      };
    };

function defaultSessionFilePath(cwd: string): string {
  return resolve(cwd, "data", "bridges", "generic", "session.json");
}

function parseCapabilities(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgMap(argv: string[]): {
  command: string[];
  flags: Record<string, string>;
} {
  const command: string[] = [];
  const flags: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      command.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = "true";
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return { command, flags };
}

function requireValue(value: string | undefined, fieldName: string): string {
  if (!value) {
    throw new Error(`generic_bridge_missing_${fieldName}`);
  }

  return value;
}

type AgentInviteDefaults = {
  baseUrl?: string;
  token?: string;
  roomId?: string;
};

function readAgentInviteDefaults(inviteFilePath: string | undefined): AgentInviteDefaults {
  if (!inviteFilePath) {
    return {};
  }

  const invite = JSON.parse(readFileSync(inviteFilePath, "utf8")) as {
    type?: unknown;
    baseUrl?: unknown;
    token?: unknown;
    primaryRoomId?: unknown;
    roomIds?: unknown;
  };

  if (invite.type !== "multi-agent-room-invite") {
    throw new Error("generic_bridge_invalid_invite_type");
  }

  const fallbackRoomId =
    Array.isArray(invite.roomIds) && typeof invite.roomIds[0] === "string" ? invite.roomIds[0] : undefined;

  return {
    baseUrl: typeof invite.baseUrl === "string" ? invite.baseUrl : undefined,
    token: typeof invite.token === "string" ? invite.token : undefined,
    roomId: typeof invite.primaryRoomId === "string" ? invite.primaryRoomId : fallbackRoomId
  };
}

export function parseGenericBridgeCliArgs(
  argv: string[],
  env: EnvLike,
  cwd: string
): GenericBridgeCliCommand {
  const { command, flags } = parseArgMap(argv);
  const commandKey = command.join(".");
  const sessionFilePath = flags["session-file"] ?? env.MA_BRIDGE_SESSION_FILE ?? defaultSessionFilePath(cwd);
  const inviteDefaults = readAgentInviteDefaults(flags["invite-file"] ?? env.MA_BRIDGE_INVITE_FILE);

  if (commandKey === "session.start") {
    const heartbeatMs = Number.parseInt(
      flags["heartbeat-ms"] ?? env.MA_BRIDGE_HEARTBEAT_MS ?? String(DEFAULT_HEARTBEAT_MS),
      10
    );
    const capabilities = parseCapabilities(flags.capabilities ?? env.MA_BRIDGE_CAPABILITIES);

    return {
      kind: "session.start",
      options: {
        baseUrl: requireValue(flags["base-url"] ?? env.MA_BRIDGE_BASE_URL ?? inviteDefaults.baseUrl, "base_url"),
        token: requireValue(flags.token ?? env.MA_BRIDGE_TOKEN ?? inviteDefaults.token, "token"),
        agentId: requireValue(flags["agent-id"] ?? env.MA_BRIDGE_AGENT_ID, "agent_id"),
        displayName: flags["display-name"] ?? env.MA_BRIDGE_DISPLAY_NAME ?? "Generic Agent",
        roomId: requireValue(flags["room-id"] ?? env.MA_BRIDGE_ROOM_ID ?? inviteDefaults.roomId, "room_id"),
        capabilities: capabilities.length > 0 ? capabilities : ["chat"],
        sessionFilePath,
        heartbeatMs: Number.isFinite(heartbeatMs) && heartbeatMs > 0 ? heartbeatMs : DEFAULT_HEARTBEAT_MS
      }
    };
  }

  if (commandKey === "session.stop") {
    return {
      kind: "session.stop",
      options: {
        sessionFilePath
      }
    };
  }

  if (commandKey === "message.send") {
    return {
      kind: "message.send",
      options: {
        sessionFilePath,
        body: flags.body
      }
    };
  }

  if (commandKey === "workspace.snapshot") {
    const eventLimitValue = flags["event-limit"] ? Number.parseInt(flags["event-limit"], 10) : undefined;

    return {
      kind: "workspace.snapshot",
      options: {
        sessionFilePath,
        eventLimit:
          Number.isFinite(eventLimitValue) && eventLimitValue && eventLimitValue > 0
            ? eventLimitValue
            : undefined
      }
    };
  }

  if (commandKey === "events.pull") {
    const limitValue = flags.limit ? Number.parseInt(flags.limit, 10) : undefined;

    return {
      kind: "events.pull",
      options: {
        sessionFilePath,
        afterEventId: flags["after-event-id"],
        limit: Number.isFinite(limitValue) && limitValue && limitValue > 0 ? limitValue : undefined
      }
    };
  }

  if (commandKey === "events.watch") {
    const limitValue = flags.limit ? Number.parseInt(flags.limit, 10) : undefined;
    const pollMsValue = flags["poll-ms"] ? Number.parseInt(flags["poll-ms"], 10) : DEFAULT_POLL_MS;

    return {
      kind: "events.watch",
      options: {
        sessionFilePath,
        afterEventId: flags["after-event-id"],
        limit: Number.isFinite(limitValue) && limitValue && limitValue > 0 ? limitValue : undefined,
        pollMs: Number.isFinite(pollMsValue) && pollMsValue > 0 ? pollMsValue : DEFAULT_POLL_MS,
        outputFormat: flags.format === "transcript" ? "transcript" : "json"
      }
    };
  }

  throw new Error(`generic_bridge_unknown_command:${commandKey || "empty"}`);
}

export function formatGenericBridgeUsage(): string {
  return [
    "Usage:",
    "  npm --workspace @ma/bridge-generic run dev -- session start --invite-file <invite.json> --agent-id <id>",
    "  npm --workspace @ma/bridge-generic run dev -- message send --body <text>",
    "  npm --workspace @ma/bridge-generic run dev -- events pull --after-event-id <event-id>",
    "  npm --workspace @ma/bridge-generic run dev -- events watch --poll-ms <ms> --format json|transcript",
    "  npm --workspace @ma/bridge-generic run dev -- workspace snapshot --event-limit <n>",
    "  npm --workspace @ma/bridge-generic run dev -- session stop",
    "",
    "Environment fallbacks:",
    "  MA_BRIDGE_INVITE_FILE",
    "  MA_BRIDGE_BASE_URL",
    "  MA_BRIDGE_TOKEN",
    "  MA_BRIDGE_AGENT_ID",
    "  MA_BRIDGE_DISPLAY_NAME",
    "  MA_BRIDGE_ROOM_ID",
    "  MA_BRIDGE_CAPABILITIES",
    "  MA_BRIDGE_SESSION_FILE",
    "  MA_BRIDGE_HEARTBEAT_MS"
  ].join("\n");
}
