import { join, resolve } from "node:path";

type EnvLike = Record<string, string | undefined>;

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

export type CodexBridgeCliCommand =
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
  return resolve(cwd, "data", "bridges", "codex", "session.json");
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
    throw new Error(`codex_bridge_missing_${fieldName}`);
  }

  return value;
}

export function parseCodexBridgeCliArgs(
  argv: string[],
  env: EnvLike,
  cwd: string
): CodexBridgeCliCommand {
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
        displayName: flags["display-name"] ?? env.MA_BRIDGE_DISPLAY_NAME ?? "Codex",
        roomId: requireValue(flags["room-id"] ?? env.MA_BRIDGE_ROOM_ID, "room_id"),
        capabilities: capabilities.length > 0 ? capabilities : ["chat", "code"],
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

  throw new Error(`codex_bridge_unknown_command:${commandKey || "empty"}`);
}

export function formatCodexBridgeUsage(): string {
  return [
    "Usage:",
    "  npm --workspace @ma/bridge-codex run dev -- session start --base-url <url> --token <token> --agent-id <id> --room-id <room>",
    "  npm --workspace @ma/bridge-codex run dev -- message send --body <text>",
    "  npm --workspace @ma/bridge-codex run dev -- events pull --after-event-id <event-id>",
    "  npm --workspace @ma/bridge-codex run dev -- attachment send --file <path> --caption <text>",
    "  npm --workspace @ma/bridge-codex run dev -- session stop",
    "",
    "Environment fallbacks:",
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
