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
  diagnostics?: BridgeDiagnosticsInput;
};

type BridgeDiagnosticsInput = {
  lastEventId?: string;
  reconnectCount?: number;
  consecutiveFailures?: number;
  lastError?: string | null;
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

type BridgePullEventsInput = BridgeJoinRoomInput & {
  afterEventId?: string;
  limit?: number;
};

export type GenericBridgeClient = {
  connect<T>(input: BridgeConnectInput): Promise<T>;
  heartbeat<T>(input: BridgeSessionInput): Promise<T>;
  disconnect<T>(input: BridgeSessionInput): Promise<T>;
  joinRoom<T>(input: BridgeJoinRoomInput): Promise<T>;
  sendMessage<T>(input: BridgeSendMessageInput): Promise<T>;
  pullEvents<T>(input: BridgePullEventsInput): Promise<T>;
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

type PullEventsOptions = SessionFileOptions & {
  afterEventId?: string;
  limit?: number;
};

type WatchEventsOptions = PullEventsOptions & {
  pollMs: number;
  onBatch?: (batch: unknown) => void | Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
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

function buildDiagnostics(session: GenericBridgeSessionRecord): BridgeDiagnosticsInput | undefined {
  const diagnostics: BridgeDiagnosticsInput = {};

  if (session.lastEventId !== undefined) {
    diagnostics.lastEventId = session.lastEventId;
  }

  if (session.reconnectCount !== undefined) {
    diagnostics.reconnectCount = session.reconnectCount;
  }

  if (session.consecutiveFailures !== undefined) {
    diagnostics.consecutiveFailures = session.consecutiveFailures;
  }

  if (session.lastError !== undefined) {
    diagnostics.lastError = session.lastError;
  }

  return Object.keys(diagnostics).length > 0 ? diagnostics : undefined;
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
    const currentSession = readGenericBridgeSessionFile(options.sessionFilePath);
    void client.heartbeat({
      sessionId: currentSession.sessionId,
      agentId: currentSession.agentId,
      diagnostics: buildDiagnostics(currentSession)
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

export async function pullGenericBridgeEvents<T = unknown>(
  options: PullEventsOptions
): Promise<T> {
  const session = readGenericBridgeSessionFile(options.sessionFilePath);
  const client = resolveClient({
    client: options.client,
    baseUrl: session.baseUrl,
    token: session.token
  });

  return client.pullEvents<T>({
    sessionId: session.sessionId,
    agentId: session.agentId,
    roomId: session.roomId,
    afterEventId: options.afterEventId,
    limit: options.limit
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getEventBody(event: unknown): string {
  const body = (event as { payload?: { body?: unknown } })?.payload?.body;
  return typeof body === "string" ? body : "";
}

function getEventPayload(event: unknown): Record<string, unknown> {
  const payload = (event as { payload?: unknown })?.payload;
  return typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
}

function getEventMessageId(event: unknown): string | undefined {
  const messageId = getEventPayload(event).messageId;
  return typeof messageId === "string" && messageId.length > 0 ? messageId : undefined;
}

function getEventSpeakerParticipantId(event: unknown): string | undefined {
  const speakerParticipantId = getEventPayload(event).speakerParticipantId;
  return typeof speakerParticipantId === "string" && speakerParticipantId.length > 0
    ? speakerParticipantId
    : undefined;
}

function isStructuredMentionForAgent(event: unknown, session: GenericBridgeSessionRecord): boolean {
  const mentions = getEventPayload(event).mentions;
  if (!Array.isArray(mentions)) {
    return false;
  }

  return mentions.some((mention) => {
    if (typeof mention !== "object" || mention === null) {
      return false;
    }

    const record = mention as { participantId?: unknown; displayName?: unknown };
    return record.participantId === session.agentId || record.displayName === session.displayName;
  });
}

function isStructuredReplyForAgent(
  event: unknown,
  session: GenericBridgeSessionRecord,
  events: unknown[]
): boolean {
  const replyToMessageId = getEventPayload(event).replyToMessageId;
  if (typeof replyToMessageId !== "string" || replyToMessageId.length === 0) {
    return false;
  }

  const repliedEvent = events.find((candidate) => getEventMessageId(candidate) === replyToMessageId);
  return getEventSpeakerParticipantId(repliedEvent) === session.agentId;
}

function resolveAttentionTags(event: unknown, session: GenericBridgeSessionRecord, events: unknown[]): string[] {
  const body = getEventBody(event);
  const names = [session.displayName, session.agentId].filter(Boolean);
  const tags: string[] = [];

  if (isStructuredMentionForAgent(event, session)) {
    tags.push("mentioned-you");
  } else if (
    body &&
    names.some((name) =>
      new RegExp(`(^|\\s)@${escapeRegExp(name)}(?=$|\\s|[.,!?，。！？:：;；、])`, "u").test(body)
    )
  ) {
    tags.push("mentioned-you");
  }

  if (isStructuredReplyForAgent(event, session, events)) {
    tags.push("reply-to-you");
  } else if (
    body &&
    names.some((name) =>
      new RegExp(`^>\\s*回复\\s+${escapeRegExp(name)}\\s*:`, "u").test(body)
    )
  ) {
    tags.push("reply-to-you");
  }

  return tags;
}

function annotateWatchedBatch(batch: unknown, session: GenericBridgeSessionRecord): unknown {
  const items = (batch as { items?: unknown })?.items;
  if (!Array.isArray(items)) {
    return batch;
  }

  return {
    ...(batch as Record<string, unknown>),
    items: items.map((item) => {
      const attentionTags = resolveAttentionTags(item, session, items);
      return attentionTags.length > 0 ? { ...(item as Record<string, unknown>), attentionTags } : item;
    })
  };
}

function persistEventCursor(sessionFilePath: string, lastEventId: string | undefined): void {
  if (!lastEventId) {
    return;
  }

  const session = readGenericBridgeSessionFile(sessionFilePath);
  writeGenericBridgeSessionFile(sessionFilePath, {
    ...session,
    lastEventId,
    consecutiveFailures: 0,
    lastError: null
  });
}

function persistWatchFailure(
  sessionFilePath: string,
  input: { consecutiveFailures: number; lastError: string }
): void {
  const session = readGenericBridgeSessionFile(sessionFilePath);
  writeGenericBridgeSessionFile(sessionFilePath, {
    ...session,
    consecutiveFailures: input.consecutiveFailures,
    lastError: input.lastError
  });
}

function isRecoverableSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("bridge_request_failed:404") ||
    message.includes("bridge_request_failed:409")
  );
}

async function reconnectGenericBridgeSession(
  client: GenericBridgeClient,
  sessionFilePath: string
): Promise<GenericBridgeSessionRecord> {
  const session = readGenericBridgeSessionFile(sessionFilePath);
  const connected = await client.connect({
    agentId: session.agentId,
    displayName: session.displayName,
    capabilities: session.capabilities
  });
  const sessionId = requireSessionId(connected);

  await client.joinRoom({
    sessionId,
    agentId: session.agentId,
    roomId: session.roomId,
    displayName: session.displayName,
    capabilities: session.capabilities
  });

  const reconnected = {
    ...session,
    sessionId,
    reconnectCount: (session.reconnectCount ?? 0) + 1,
    consecutiveFailures: 0,
    lastError: null
  };
  writeGenericBridgeSessionFile(sessionFilePath, reconnected);
  return reconnected;
}

function resolveRetryDelayMs(pollMs: number, failureCount: number): number {
  return Math.min(pollMs * 2 ** Math.max(failureCount - 1, 0), 30_000);
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

export async function watchGenericBridgeEvents(options: WatchEventsOptions): Promise<void> {
  const session = readGenericBridgeSessionFile(options.sessionFilePath);
  let afterEventId = options.afterEventId ?? session.lastEventId;
  const sleep = options.sleep ?? defaultSleep;
  let failureCount = 0;
  let activeSessionId = session.sessionId;
  const client = resolveClient({
    client: options.client,
    baseUrl: session.baseUrl,
    token: session.token
  });

  while (!options.signal?.aborted) {
    let batch: unknown;
    try {
      const currentSession = readGenericBridgeSessionFile(options.sessionFilePath);
      activeSessionId = currentSession.sessionId;
      batch = await client.pullEvents({
        sessionId: activeSessionId,
        agentId: currentSession.agentId,
        roomId: currentSession.roomId,
        afterEventId,
        limit: options.limit
      });
      failureCount = 0;
    } catch (error) {
      if (isRecoverableSessionError(error)) {
        persistWatchFailure(options.sessionFilePath, {
          consecutiveFailures: 1,
          lastError: error instanceof Error ? error.message : String(error)
        });
        const reconnected = await reconnectGenericBridgeSession(client, options.sessionFilePath);
        activeSessionId = reconnected.sessionId;
        failureCount = 0;
        continue;
      }

      failureCount += 1;
      persistWatchFailure(options.sessionFilePath, {
        consecutiveFailures: failureCount,
        lastError: error instanceof Error ? error.message : String(error)
      });
      await sleep(resolveRetryDelayMs(options.pollMs, failureCount));
      continue;
    }

    if (hasBatchItems(batch)) {
      await options.onBatch?.(
        annotateWatchedBatch(batch, readGenericBridgeSessionFile(options.sessionFilePath))
      );
    }

    afterEventId = resolveNextCursor(batch, afterEventId);
    persistEventCursor(options.sessionFilePath, afterEventId);
    await sleep(options.pollMs);
  }
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
