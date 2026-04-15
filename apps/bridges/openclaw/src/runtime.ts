import { createBridgeClient } from "../../shared/src/client";

import {
  readOpenClawBridgeSessionFile,
  removeOpenClawBridgeSessionFile,
  type OpenClawBridgeSessionRecord,
  writeOpenClawBridgeSessionFile
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

export type OpenClawBridgeClient = {
  connect<T>(input: BridgeConnectInput): Promise<T>;
  heartbeat<T>(input: BridgeSessionInput): Promise<T>;
  disconnect<T>(input: BridgeSessionInput): Promise<T>;
  joinRoom<T>(input: BridgeJoinRoomInput): Promise<T>;
  sendMessage<T>(input: BridgeSendMessageInput): Promise<T>;
};

type Logger = Pick<typeof console, "log" | "error">;

type StartSessionOptions = {
  client?: OpenClawBridgeClient;
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
  client?: OpenClawBridgeClient;
  sessionFilePath: string;
};

type SendMessageOptions = SessionFileOptions & {
  body: string;
};

export type RunningOpenClawBridgeSession = {
  session: OpenClawBridgeSessionRecord;
  shutdown: () => Promise<void>;
};

const DEFAULT_HEARTBEAT_MS = 45_000;

function resolveClient(options: {
  client?: OpenClawBridgeClient;
  baseUrl: string;
  token: string;
}): OpenClawBridgeClient {
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
    throw new Error("openclaw_bridge_connect_missing_session_id");
  }

  return sessionId;
}

export async function runOpenClawBridgeSession(
  options: StartSessionOptions
): Promise<RunningOpenClawBridgeSession> {
  const displayName = options.displayName ?? "OpenClaw";
  const capabilities = options.capabilities ?? ["chat", "tools"];
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

  const session: OpenClawBridgeSessionRecord = {
    baseUrl: options.baseUrl,
    token: options.token,
    sessionId,
    agentId: options.agentId,
    displayName,
    roomId: options.roomId,
    capabilities,
    heartbeatMs
  };
  writeOpenClawBridgeSessionFile(options.sessionFilePath, session);

  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  const intervalHandle = setIntervalFn(() => {
    void client
      .heartbeat({
        sessionId,
        agentId: options.agentId
      })
      .catch((error) => {
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
        removeOpenClawBridgeSessionFile(options.sessionFilePath);
      }
    }
  };
}

export async function sendOpenClawBridgeMessage<T = unknown>(
  options: SendMessageOptions
): Promise<T> {
  const session = readOpenClawBridgeSessionFile(options.sessionFilePath);
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

export async function stopOpenClawBridgeSession<T = unknown>(
  options: SessionFileOptions
): Promise<T> {
  const session = readOpenClawBridgeSessionFile(options.sessionFilePath);
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
    removeOpenClawBridgeSessionFile(options.sessionFilePath);
  }
}
