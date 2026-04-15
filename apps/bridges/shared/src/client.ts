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
};

type JoinRoomInput = SessionInput & {
  roomId: string;
  displayName?: string;
  capabilities?: string[];
};

type SendMessageInput = JoinRoomInput & {
  body: string;
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
    }
  };
}
