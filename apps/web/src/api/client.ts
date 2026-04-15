export type SpaceRecord = {
  id: string;
  name: string;
};

export type RoomRecord = {
  id: string;
  spaceId: string;
  name: string;
  participantIds: string[];
};

export type MessageEventRecord = {
  eventId: string;
  kind: string;
  roomId: string;
  timestamp: string;
  payload: {
    messageId?: string;
    speakerParticipantId?: string;
    body?: string;
  };
};

export type AttachmentRecord = {
  id: string;
  messageId: string;
  kind: "image" | "file" | "link";
  url: string;
};

export type UploadAttachmentResponse = {
  attachment: AttachmentRecord;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

export type ParticipantRecord = {
  id: string;
  type: "human" | "agent" | "bridge" | "system";
  displayName: string;
  bridgeKind: "codex" | "openclaw" | "generic" | null;
  capabilities: string[];
  createdAt: string;
  lastSeenAt: string;
};

export type BridgeKind = "codex" | "openclaw" | "generic";

export type BridgeTokenRecord = {
  id: string;
  label: string;
  bridgeKind: BridgeKind;
  allowedRoomIds: string[];
  createdAt: string;
  revokedAt: string | null;
};

export type BridgeTokenCreateResponse = {
  token: string;
  metadata: BridgeTokenRecord;
};

export type BridgeSessionRecord = {
  id: string;
  tokenId: string;
  agentId: string;
  status: "connected" | "disconnected";
  activeRoomIds: string[];
  connectedAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

export type RoomSummaryRecord = {
  roomId: string;
  generatedAt: string;
  messageCount: number;
  participantCount: number;
  summaryText: string;
  sourceEventRange: {
    firstMessageId: string;
    lastMessageId: string;
  };
};

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {})
      },
      ...init
    });

    if (!response.ok) {
      throw new Error(`request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  async listSpaces(): Promise<SpaceRecord[]> {
    const response = await this.request<{ items: SpaceRecord[] }>("/api/spaces");
    return response.items;
  }

  async listRooms(spaceId: string): Promise<RoomRecord[]> {
    const params = new URLSearchParams({ spaceId });
    const response = await this.request<{ items: RoomRecord[] }>(`/api/rooms?${params.toString()}`);
    return response.items;
  }

  async createRoom(input: { spaceId: string; name: string }): Promise<RoomRecord> {
    return this.request<RoomRecord>("/api/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
  }

  async listMessages(roomId: string): Promise<MessageEventRecord[]> {
    const params = new URLSearchParams({ roomId });
    const response = await this.request<{ items: MessageEventRecord[] }>(
      `/api/messages?${params.toString()}`
    );
    return response.items;
  }

  async createMessage(input: {
    roomId: string;
    speakerParticipantId: string;
    body: string;
  }): Promise<MessageEventRecord> {
    return this.request<MessageEventRecord>("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
  }

  async uploadFile(file: File): Promise<UploadAttachmentResponse> {
    const formData = new FormData();
    formData.append("file", file);

    return this.request<UploadAttachmentResponse>("/api/uploads", {
      method: "POST",
      body: formData
    });
  }

  async listParticipants(): Promise<ParticipantRecord[]> {
    const response = await this.request<{ items: ParticipantRecord[] }>("/api/participants");
    return response.items;
  }

  async listBridgeTokens(): Promise<BridgeTokenRecord[]> {
    const response = await this.request<{ items: BridgeTokenRecord[] }>("/api/bridge-tokens");
    return response.items;
  }

  async createBridgeToken(input: {
    label: string;
    bridgeKind: BridgeKind;
    allowedRoomIds: string[];
  }): Promise<BridgeTokenCreateResponse> {
    return this.request<BridgeTokenCreateResponse>("/api/bridge-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
  }

  async revokeBridgeToken(id: string): Promise<BridgeTokenRecord> {
    return this.request<BridgeTokenRecord>(`/api/bridge-tokens/${id}/revoke`, {
      method: "POST"
    });
  }

  async listBridgeSessions(): Promise<BridgeSessionRecord[]> {
    const response = await this.request<{ items: BridgeSessionRecord[] }>("/api/bridge-sessions");
    return response.items;
  }

  async listRoomSummaries(roomId: string): Promise<RoomSummaryRecord[]> {
    const params = new URLSearchParams({ roomId });
    const response = await this.request<{ items: RoomSummaryRecord[] }>(
      `/api/room-summaries?${params.toString()}`
    );
    return response.items;
  }
}
