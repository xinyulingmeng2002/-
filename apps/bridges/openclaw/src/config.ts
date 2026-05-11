import { resolve } from "node:path";

type EnvLike = Record<string, string | undefined>;

const DEFAULT_POLL_MS = 2_000;

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

export type OpenClawBridgeCliCommand =
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
      kind: "events.pull";
      options: {
        sessionFilePath: string;
        roomId?: string;
        afterEventId?: string;
        limit?: number;
      };
    }
  | {
      kind: "events.watch";
      options: {
        sessionFilePath: string;
        roomId?: string;
        afterEventId?: string;
        limit?: number;
        pollMs: number;
      };
    }
  | {
      kind: "workspace.snapshot";
      options: {
        sessionFilePath: string;
        roomId?: string;
        eventLimit?: number;
      };
    }
  | {
      kind: "attachment.send";
      options: {
        sessionFilePath: string;
        filePath: string;
        caption?: string;
        mimeType?: string;
      };
    };

const DEFAULT_HEARTBEAT_MS = 45_000;

function defaultSessionFilePath(cwd: string): string {
  return resolve(cwd, "data", "bridges", "openclaw", "session.json");
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
    throw new Error(`openclaw_bridge_missing_${fieldName}`);
  }

  return value;
}

export function parseOpenClawBridgeCliArgs(
  argv: string[],
  env: EnvLike,
  cwd: string
): OpenClawBridgeCliCommand {
  const { command, flags } = parseArgMap(argv);
  const commandKey = command.join(".");
  const sessionFilePath = flags["session-file"] ?? env.MA_BRIDGE_SESSION_FILE ?? defaultSessionFilePath(cwd);

  if (commandKey === "session.start") {
    const heartbeatMs = Number.parseInt(
      flags["heartbeat-ms"] ?? env.MA_BRIDGE_HEARTBEAT_MS ?? String(DEFAULT_HEARTBEAT_MS),
      10
    );
    const capabilities = parseCapabilities(flags.capabilities ?? env.MA_BRIDGE_CAPABILITIES);

    return {
      kind: "session.start",
      options: {
        baseUrl: requireValue(flags["base-url"] ?? env.MA_BRIDGE_BASE_URL, "base_url"),
        token: requireValue(flags.token ?? env.MA_BRIDGE_TOKEN, "token"),
        agentId: requireValue(flags["agent-id"] ?? env.MA_BRIDGE_AGENT_ID, "agent_id"),
        displayName: flags["display-name"] ?? env.MA_BRIDGE_DISPLAY_NAME ?? "OpenClaw",
        roomId: requireValue(flags["room-id"] ?? env.MA_BRIDGE_ROOM_ID, "room_id"),
        capabilities: capabilities.length > 0 ? capabilities : ["chat", "tools"],
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

  if (commandKey === "events.pull") {
    const limitValue = flags.limit ? Number.parseInt(flags.limit, 10) : undefined;

    return {
      kind: "events.pull",
      options: {
        sessionFilePath,
        roomId: flags["room-id"],
        afterEventId: flags["after-event-id"],
        limit: Number.isFinite(limitValue) && limitValue && limitValue > 0 ? limitValue : undefined
      }
    };
  }

  if (commandKey === "events.watch") {
    const limitValue = flags.limit ? Number.parseInt(flags.limit, 10) : undefined;
    const pollMs = Number.parseInt(flags["poll-ms"] ?? env.MA_BRIDGE_POLL_MS ?? String(DEFAULT_POLL_MS), 10);

    return {
      kind: "events.watch",
      options: {
        sessionFilePath,
        roomId: flags["room-id"],
        afterEventId: flags["after-event-id"],
        limit: Number.isFinite(limitValue) && limitValue && limitValue > 0 ? limitValue : undefined,
        pollMs: Number.isFinite(pollMs) && pollMs > 0 ? pollMs : DEFAULT_POLL_MS
      }
    };
  }

  if (commandKey === "workspace.snapshot") {
    const eventLimitValue = flags["event-limit"] ? Number.parseInt(flags["event-limit"], 10) : undefined;

    return {
      kind: "workspace.snapshot",
      options: {
        sessionFilePath,
        roomId: flags["room-id"],
        eventLimit:
          Number.isFinite(eventLimitValue) && eventLimitValue && eventLimitValue > 0
            ? eventLimitValue
            : undefined
      }
    };
  }

  if (commandKey === "attachment.send") {
    return {
      kind: "attachment.send",
      options: {
        sessionFilePath,
        filePath: requireValue(flags.file, "file"),
        caption: flags.caption,
        mimeType: flags["mime-type"]
      }
    };
  }

  throw new Error(`openclaw_bridge_unknown_command:${commandKey || "empty"}`);
}

export function formatOpenClawBridgeUsage(): string {
  return [
    "Usage:",
    "  npm --workspace @ma/bridge-openclaw run dev -- session start --base-url <url> --token <token> --agent-id <id> --room-id <room>",
    "  npm --workspace @ma/bridge-openclaw run dev -- message send --body <text>",
    "  npm --workspace @ma/bridge-openclaw run dev -- events pull --after-event-id <event-id>",
    "  npm --workspace @ma/bridge-openclaw run dev -- events watch --after-event-id <event-id> --poll-ms <ms>",
    "  npm --workspace @ma/bridge-openclaw run dev -- workspace snapshot --event-limit <n>",
    "  npm --workspace @ma/bridge-openclaw run dev -- attachment send --file <path> --caption <text>",
    "  npm --workspace @ma/bridge-openclaw run dev -- session stop",
    "",
    "Environment fallbacks:",
    "  MA_BRIDGE_BASE_URL",
    "  MA_BRIDGE_TOKEN",
    "  MA_BRIDGE_AGENT_ID",
    "  MA_BRIDGE_DISPLAY_NAME",
    "  MA_BRIDGE_ROOM_ID",
    "  MA_BRIDGE_CAPABILITIES",
    "  MA_BRIDGE_SESSION_FILE",
    "  MA_BRIDGE_HEARTBEAT_MS",
    "  MA_BRIDGE_POLL_MS"
  ].join("\n");
}
