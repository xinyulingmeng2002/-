import { createBridgeClient } from "../../shared/src/client";

import {
  readCodexBridgeSessionFile,
  removeCodexBridgeSessionFile,
  type CodexBridgeSessionRecord,
  writeCodexBridgeSessionFile
} from "./session-file";

type BridgeConnectInput = {
  agentId: string;
  displayName?: string;
  capabilities?: string[];
};

type BridgeSessionInput = {
  sessionId?: string;
  agentId: string;
};

type BridgeJoinRoomInput = BridgeSessionInput & {
  roomId: string;
  displayName?: string;
  capabilities?: string[];
};

type BridgeSendMessageInput = BridgeJoinRoomInput & {
  body: string;
};

export type CodexBridgeClient = {
  connect<T>(input: BridgeConnectInput): Promise<T>;
  heartbeat<T>(input: BridgeSessionInput): Promise<T>;
  disconnect<T>(input: BridgeSessionInput): Promise<T>;
  joinRoom<T>(input: BridgeJoinRoomInput): Promise<T>;
  sendMessage<T>(input: BridgeSendMessageInput): Promise<T>;
};

type Logger = Pick<typeof console, "log" | "error">;

type StartSessionOptions = {
  client?: CodexBridgeClient;
  baseUrl: string;
  token: string;
  agentId: string;
  displayName?: string;
  roomId: string;
  capabilities?: string[];
  sessionFilePath: string;
  heartbeatMs?: number;
  logger?: Logger;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
};

type SessionFileOptions = {
  client?: CodexBridgeClient;
  sessionFilePath: string;
};

type SendMessageOptions = SessionFileOptions & {
  body: string;
};

export type RunningCodexBridgeSession = {
  session: CodexBridgeSessionRecord;
  shutdown: () => Promise<void>;
};

const DEFAULT_HEARTBEAT_MS = 45_000;

function resolveClient(options: {
  client?: CodexBridgeClient;
  baseUrl: string;
  token: string;
}): CodexBridgeClient {
  return (
    options.client ??
    createBridgeClient({
      baseUrl: options.baseUrl,
      token: options.token
    })
  );
}

function requireSessionId(response: unknown): string {
  const sessionId = (response as { session?: { id?: unknown } })?.session?.id;
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new Error("codex_bridge_connect_missing_session_id");
  }

  return sessionId;
}

export async function runCodexBridgeSession(
  options: StartSessionOptions
): Promise<RunningCodexBridgeSession> {
  const displayName = options.displayName ?? "Codex";
  const capabilities = options.capabilities ?? ["chat", "code"];
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const logger = options.logger ?? console;
  const client = resolveClient({
    client: options.client,
    baseUrl: options.baseUrl,
    token: options.token
  });

  const connected = await client.connect({
    agentId: options.agentId,
    displayName,
    capabilities
  });
  const sessionId = requireSessionId(connected);

  await client.joinRoom({
    sessionId,
    agentId: options.agentId,
    roomId: options.roomId,
    displayName,
    capabilities
  });

  const session: CodexBridgeSessionRecord = {
    baseUrl: options.baseUrl,
    token: options.token,
    sessionId,
    agentId: options.agentId,
    displayName,
    roomId: options.roomId,
    capabilities,
    heartbeatMs
  };
  writeCodexBridgeSessionFile(options.sessionFilePath, session);

  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  const intervalHandle = setIntervalFn(() => {
    void client.heartbeat({
      sessionId,
      agentId: options.agentId
    }).catch((error) => {
      logger.error(error);
    });
  }, heartbeatMs);

  let shuttingDown = false;

  return {
    session,
    async shutdown() {
      if (shuttingDown) {
        return;
      }

      shuttingDown = true;
      clearIntervalFn(intervalHandle);

      try {
        await client.disconnect({
          sessionId,
          agentId: options.agentId
        });
      } finally {
        removeCodexBridgeSessionFile(options.sessionFilePath);
      }
    }
  };
}

export async function sendCodexBridgeMessage<T = unknown>(
  options: SendMessageOptions
): Promise<T> {
  const session = readCodexBridgeSessionFile(options.sessionFilePath);
  const client = resolveClient({
    client: options.client,
    baseUrl: session.baseUrl,
    token: session.token
  });

  return client.sendMessage<T>({
    sessionId: session.sessionId,
    agentId: session.agentId,
    roomId: session.roomId,
    body: options.body
  });
}

export async function stopCodexBridgeSession<T = unknown>(
  options: SessionFileOptions
): Promise<T> {
  const session = readCodexBridgeSessionFile(options.sessionFilePath);
  const client = resolveClient({
    client: options.client,
    baseUrl: session.baseUrl,
    token: session.token
  });

  try {
    return await client.disconnect<T>({
      sessionId: session.sessionId,
      agentId: session.agentId
    });
  } finally {
    removeCodexBridgeSessionFile(options.sessionFilePath);
  }
}
