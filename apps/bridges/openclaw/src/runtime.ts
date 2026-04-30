import { basename } from "node:path";
import { readFileSync } from "node:fs";

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

type BridgeAttachmentInput = {
  id: string;
  messageId: string;
  kind: "image" | "file" | "link";
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

type BridgeSendMessageInput = BridgeJoinRoomInput & {
  body: string;
  attachments?: BridgeAttachmentInput[];
};

type BridgePullEventsInput = BridgeJoinRoomInput & {
  afterEventId?: string;
  limit?: number;
};

type BridgeUploadFileInput = {
  fileName: string;
  mimeType?: string;
  content: Uint8Array;
};

export type OpenClawBridgeClient = {
  connect<T>(input: BridgeConnectInput): Promise<T>;
  heartbeat<T>(input: BridgeSessionInput): Promise<T>;
  disconnect<T>(input: BridgeSessionInput): Promise<T>;
  joinRoom<T>(input: BridgeJoinRoomInput): Promise<T>;
  sendMessage<T>(input: BridgeSendMessageInput): Promise<T>;
  pullEvents<T>(input: BridgePullEventsInput): Promise<T>;
  uploadFile<T>(input: BridgeUploadFileInput): Promise<T>;
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

type PullEventsOptions = SessionFileOptions & {
  roomId?: string;
  afterEventId?: string;
  limit?: number;
};

type SendAttachmentOptions = SessionFileOptions & {
  filePath: string;
  caption?: string;
  mimeType?: string;
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

async function disconnectOpenClawBridgeSession(
  client: OpenClawBridgeClient,
  sessionId: string,
  agentId: string
): Promise<void> {
  await client.disconnect({
    sessionId,
    agentId
  });
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

  try {
    await client.joinRoom({
      sessionId,
      agentId: options.agentId,
      roomId: options.roomId,
      displayName,
      capabilities
    });
  } catch (error) {
    try {
      await disconnectOpenClawBridgeSession(client, sessionId, options.agentId);
    } catch (disconnectError) {
      logger.error(disconnectError);
    }

    throw error;
  }

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

      await disconnectOpenClawBridgeSession(client, sessionId, options.agentId);
      removeOpenClawBridgeSessionFile(options.sessionFilePath);
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

export async function pullOpenClawBridgeEvents<T = unknown>(
  options: PullEventsOptions
): Promise<T> {
  const session = readOpenClawBridgeSessionFile(options.sessionFilePath);
  const client = resolveClient({
    client: options.client,
    baseUrl: session.baseUrl,
    token: session.token
  });

  return client.pullEvents<T>({
    sessionId: session.sessionId,
    agentId: session.agentId,
    roomId: options.roomId ?? session.roomId,
    afterEventId: options.afterEventId,
    limit: options.limit
  });
}

export async function sendOpenClawBridgeAttachment<
  TUpload extends { attachment: BridgeAttachmentInput; originalName: string } = {
    attachment: BridgeAttachmentInput;
    originalName: string;
  }
>(options: SendAttachmentOptions): Promise<TUpload> {
  const session = readOpenClawBridgeSessionFile(options.sessionFilePath);
  const client = resolveClient({
    client: options.client,
    baseUrl: session.baseUrl,
    token: session.token
  });

  const content = readFileSync(options.filePath);
  const uploaded = await client.uploadFile<TUpload>({
    fileName: basename(options.filePath),
    mimeType: options.mimeType,
    content
  });

  await client.sendMessage({
    sessionId: session.sessionId,
    agentId: session.agentId,
    roomId: session.roomId,
    body: options.caption?.trim() ?? "",
    attachments: [uploaded.attachment]
  });

  return uploaded;
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

  const result = await client.disconnect<T>({
    sessionId: session.sessionId,
    agentId: session.agentId
  });
  removeOpenClawBridgeSessionFile(options.sessionFilePath);
  return result;
}
