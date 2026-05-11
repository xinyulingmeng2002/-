import { basename } from "node:path";
import { readFileSync } from "node:fs";

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

type BridgeWorkspaceSnapshotInput = BridgeSessionInput & {
  roomId: string;
  eventLimit?: number;
};

type BridgeUploadFileInput = {
  fileName: string;
  mimeType?: string;
  content: Uint8Array;
};

export type CodexBridgeClient = {
  connect<T>(input: BridgeConnectInput): Promise<T>;
  heartbeat<T>(input: BridgeSessionInput): Promise<T>;
  disconnect<T>(input: BridgeSessionInput): Promise<T>;
  joinRoom<T>(input: BridgeJoinRoomInput): Promise<T>;
  sendMessage<T>(input: BridgeSendMessageInput): Promise<T>;
  pullEvents<T>(input: BridgePullEventsInput): Promise<T>;
  getWorkspaceSnapshot<T>(input: BridgeWorkspaceSnapshotInput): Promise<T>;
  uploadFile<T>(input: BridgeUploadFileInput): Promise<T>;
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

type PullEventsOptions = SessionFileOptions & {
  roomId?: string;
  afterEventId?: string;
  limit?: number;
};

type WorkspaceSnapshotOptions = SessionFileOptions & {
  roomId?: string;
  eventLimit?: number;
};

type WatchEventsOptions = PullEventsOptions & {
  pollMs: number;
  onBatch?: (batch: unknown) => void | Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
};

type SendAttachmentOptions = SessionFileOptions & {
  filePath: string;
  caption?: string;
  mimeType?: string;
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

async function disconnectCodexBridgeSession(
  client: CodexBridgeClient,
  sessionId: string,
  agentId: string
): Promise<void> {
  await client.disconnect({
    sessionId,
    agentId
  });
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
      await disconnectCodexBridgeSession(client, sessionId, options.agentId);
    } catch (disconnectError) {
      logger.error(disconnectError);
    }

    throw error;
  }

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

      await disconnectCodexBridgeSession(client, sessionId, options.agentId);
      removeCodexBridgeSessionFile(options.sessionFilePath);
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

export async function pullCodexBridgeEvents<T = unknown>(
  options: PullEventsOptions
): Promise<T> {
  const session = readCodexBridgeSessionFile(options.sessionFilePath);
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

export async function getCodexBridgeWorkspaceSnapshot<T = unknown>(
  options: WorkspaceSnapshotOptions
): Promise<T> {
  const session = readCodexBridgeSessionFile(options.sessionFilePath);
  const client = resolveClient({
    client: options.client,
    baseUrl: session.baseUrl,
    token: session.token
  });

  return client.getWorkspaceSnapshot<T>({
    sessionId: session.sessionId,
    agentId: session.agentId,
    roomId: options.roomId ?? session.roomId,
    eventLimit: options.eventLimit
  });
}

function resolveNextCursor(batch: unknown, fallback: string | undefined): string | undefined {
  const nextCursor = (batch as { nextCursor?: unknown })?.nextCursor;
  return typeof nextCursor === "string" && nextCursor.length > 0 ? nextCursor : fallback;
}

function hasBatchItems(batch: unknown): boolean {
  const items = (batch as { items?: unknown })?.items;
  return Array.isArray(items) && items.length > 0;
}

function persistEventCursor(sessionFilePath: string, lastEventId: string | undefined): void {
  if (!lastEventId) {
    return;
  }

  const session = readCodexBridgeSessionFile(sessionFilePath);
  writeCodexBridgeSessionFile(sessionFilePath, {
    ...session,
    lastEventId
  });
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

export async function watchCodexBridgeEvents(options: WatchEventsOptions): Promise<void> {
  const session = readCodexBridgeSessionFile(options.sessionFilePath);
  let afterEventId = options.afterEventId ?? session.lastEventId;
  const sleep = options.sleep ?? defaultSleep;

  while (!options.signal?.aborted) {
    const batch = await pullCodexBridgeEvents({
      client: options.client,
      sessionFilePath: options.sessionFilePath,
      roomId: options.roomId,
      afterEventId,
      limit: options.limit
    });

    if (hasBatchItems(batch)) {
      await options.onBatch?.(batch);
    }

    afterEventId = resolveNextCursor(batch, afterEventId);
    persistEventCursor(options.sessionFilePath, afterEventId);
    await sleep(options.pollMs);
  }
}

export async function sendCodexBridgeAttachment<
  TUpload extends { attachment: BridgeAttachmentInput; originalName: string } = {
    attachment: BridgeAttachmentInput;
    originalName: string;
  }
>(options: SendAttachmentOptions): Promise<TUpload> {
  const session = readCodexBridgeSessionFile(options.sessionFilePath);
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

export async function stopCodexBridgeSession<T = unknown>(
  options: SessionFileOptions
): Promise<T> {
  const session = readCodexBridgeSessionFile(options.sessionFilePath);
  const client = resolveClient({
    client: options.client,
    baseUrl: session.baseUrl,
    token: session.token
  });

  const result = await client.disconnect<T>({
    sessionId: session.sessionId,
    agentId: session.agentId
  });
  removeCodexBridgeSessionFile(options.sessionFilePath);
  return result;
}
