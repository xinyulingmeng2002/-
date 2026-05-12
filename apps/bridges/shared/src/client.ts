import {
  createTokenHeaders,
  normalizeBaseUrl,
  resolveBridgeUrl,
  type BridgeClientConfig
} from "./config";

type ConnectInput = {
  agentId: string;
  displayName?: string;
  capabilities?: string[];
};

type SessionInput = {
  sessionId?: string;
  agentId: string;
  diagnostics?: {
    lastEventId?: string;
    reconnectCount?: number;
    consecutiveFailures?: number;
    lastError?: string | null;
  };
};

type JoinRoomInput = SessionInput & {
  roomId: string;
  displayName?: string;
  capabilities?: string[];
};

type AttachmentInput = {
  id: string;
  messageId: string;
  kind: "image" | "file" | "link";
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

type SendMessageInput = JoinRoomInput & {
  body: string;
  attachments?: AttachmentInput[];
};

type PullEventsInput = JoinRoomInput & {
  afterEventId?: string;
  limit?: number;
};

type WorkspaceSnapshotInput = JoinRoomInput & {
  eventLimit?: number;
};

type UploadFileInput = {
  fileName: string;
  mimeType?: string;
  content: Uint8Array;
};

export function createBridgeClient(config: BridgeClientConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const fetchImpl = config.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("bridge_fetch_unavailable");
  }

  async function post<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetchImpl(resolveBridgeUrl(baseUrl, path), {
      method: "POST",
      headers: {
        ...createTokenHeaders(config.token),
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`bridge_request_failed:${response.status}`);
    }

    return (await response.json()) as T;
  }

  async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        continue;
      }

      search.set(key, String(value));
    }

    const response = await fetchImpl(resolveBridgeUrl(baseUrl, `${path}?${search.toString()}`), {
      method: "GET",
      headers: createTokenHeaders(config.token)
    });

    if (!response.ok) {
      throw new Error(`bridge_request_failed:${response.status}`);
    }

    return (await response.json()) as T;
  }

  async function postMultipart<T>(path: string, input: UploadFileInput): Promise<T> {
    const formData = new FormData();
    const binary = new Uint8Array(input.content).buffer;
    formData.append(
      "file",
      new Blob([binary], {
        type: input.mimeType ?? "application/octet-stream"
      }),
      input.fileName
    );

    const response = await fetchImpl(resolveBridgeUrl(baseUrl, path), {
      method: "POST",
      headers: createTokenHeaders(config.token),
      body: formData
    });

    if (!response.ok) {
      throw new Error(`bridge_request_failed:${response.status}`);
    }

    return (await response.json()) as T;
  }

  return {
    baseUrl,
    headers() {
      return createTokenHeaders(config.token);
    },
    connect<T>(input: ConnectInput): Promise<T> {
      return post<T>("/api/bridge/ingress/connect", input);
    },
    heartbeat<T>(input: SessionInput): Promise<T> {
      return post<T>("/api/bridge/ingress/heartbeat", input);
    },
    disconnect<T>(input: SessionInput): Promise<T> {
      return post<T>("/api/bridge/ingress/disconnect", input);
    },
    joinRoom<T>(input: JoinRoomInput): Promise<T> {
      return post<T>("/api/bridge/ingress/join-room", input);
    },
    sendMessage<T>(input: SendMessageInput): Promise<T> {
      return post<T>("/api/bridge/ingress/message", input);
    },
    pullEvents<T>(input: PullEventsInput): Promise<T> {
      return get<T>("/api/bridge/egress/events", {
        agentId: input.agentId,
        sessionId: input.sessionId,
        roomId: input.roomId,
        afterEventId: input.afterEventId,
        limit: input.limit
      });
    },
    getWorkspaceSnapshot<T>(input: WorkspaceSnapshotInput): Promise<T> {
      return get<T>("/api/bridge/egress/workspace", {
        agentId: input.agentId,
        sessionId: input.sessionId,
        roomId: input.roomId,
        eventLimit: input.eventLimit
      });
    },
    uploadFile<T>(input: UploadFileInput): Promise<T> {
      return postMultipart<T>("/api/uploads", input);
    }
  };
}
