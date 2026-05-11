import { createBridgeClient } from "../../shared/src/client";

import {
  readGenericBridgeSessionFile,
  removeGenericBridgeSessionFile,
  type GenericBridgeSessionRecord,
  writeGenericBridgeSessionFile
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

type BridgeWorkspaceSnapshotInput = BridgeSessionInput & {
  roomId: string;
  eventLimit?: number;
};

export type GenericBridgeClient = {
  connect<T>(input: BridgeConnectInput): Promise<T>;
  heartbeat<T>(input: BridgeSessionInput): Promise<T>;
  disconnect<T>(input: BridgeSessionInput): Promise<T>;
  joinRoom<T>(input: BridgeJoinRoomInput): Promise<T>;
  sendMessage<T>(input: BridgeSendMessageInput): Promise<T>;
  getWorkspaceSnapshot<T>(input: BridgeWorkspaceSnapshotInput): Promise<T>;
};

type StartSessionOptions = {
  client?: GenericBridgeClient;
  baseUrl: string;
  token: string;
  agentId: string;
  displayName: string;
  roomId: string;
  capabilities: string[];
  sessionFilePath: string;
  heartbeatMs: number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
};

type SessionFileOptions = {
  client?: GenericBridgeClient;
  sessionFilePath: string;
};

type SendMessageOptions = SessionFileOptions & {
  body: string;
};

type WorkspaceSnapshotOptions = SessionFileOptions & {
  eventLimit?: number;
};

export type RunningGenericBridgeSession = {
  session: GenericBridgeSessionRecord;
  shutdown: () => Promise<void>;
};

function resolveClient(options: {
  client?: GenericBridgeClient;
  baseUrl: string;
  token: string;
}): GenericBridgeClient {
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
    throw new Error("generic_bridge_connect_missing_session_id");
  }

  return sessionId;
}

export async function runGenericBridgeSession(
  options: StartSessionOptions
): Promise<RunningGenericBridgeSession> {
  const client = resolveClient({
    client: options.client,
    baseUrl: options.baseUrl,
    token: options.token
  });

  const connected = await client.connect({
    agentId: options.agentId,
    displayName: options.displayName,
    capabilities: options.capabilities
  });
  const sessionId = requireSessionId(connected);

  await client.joinRoom({
    sessionId,
    agentId: options.agentId,
    roomId: options.roomId,
    displayName: options.displayName,
    capabilities: options.capabilities
  });

  const session: GenericBridgeSessionRecord = {
    baseUrl: options.baseUrl,
    token: options.token,
    sessionId,
    agentId: options.agentId,
    displayName: options.displayName,
    roomId: options.roomId,
    capabilities: options.capabilities,
    heartbeatMs: options.heartbeatMs
  };
  writeGenericBridgeSessionFile(options.sessionFilePath, session);

  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  const intervalHandle = setIntervalFn(() => {
    void client.heartbeat({
      sessionId,
      agentId: options.agentId
    });
  }, options.heartbeatMs);

  return {
    session,
    async shutdown() {
      clearIntervalFn(intervalHandle);
      await client.disconnect({
        sessionId,
        agentId: options.agentId
      });
      removeGenericBridgeSessionFile(options.sessionFilePath);
    }
  };
}

export async function sendGenericBridgeMessage<T = unknown>(
  options: SendMessageOptions
): Promise<T> {
  const session = readGenericBridgeSessionFile(options.sessionFilePath);
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

export async function getGenericBridgeWorkspaceSnapshot<T = unknown>(
  options: WorkspaceSnapshotOptions
): Promise<T> {
  const session = readGenericBridgeSessionFile(options.sessionFilePath);
  const client = resolveClient({
    client: options.client,
    baseUrl: session.baseUrl,
    token: session.token
  });

  return client.getWorkspaceSnapshot<T>({
    sessionId: session.sessionId,
    agentId: session.agentId,
    roomId: session.roomId,
    eventLimit: options.eventLimit
  });
}

export async function stopGenericBridgeSession<T = unknown>(
  options: SessionFileOptions
): Promise<T> {
  const session = readGenericBridgeSessionFile(options.sessionFilePath);
  const client = resolveClient({
    client: options.client,
    baseUrl: session.baseUrl,
    token: session.token
  });

  const result = await client.disconnect<T>({
    sessionId: session.sessionId,
    agentId: session.agentId
  });
  removeGenericBridgeSessionFile(options.sessionFilePath);
  return result;
}
