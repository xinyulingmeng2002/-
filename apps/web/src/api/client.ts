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
    attachments?: AttachmentRecord[];
  };
};

export type AttachmentRecord = {
  id: string;
  messageId: string;
  kind: "image" | "file" | "link";
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
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

export type AgentInvitePackage = {
  type: "multi-agent-room-invite";
  version: "1";
  label: string;
  bridgeKind: BridgeKind;
  roomIds: string[];
  primaryRoomId: string | null;
  baseUrl: string;
  token: string;
  endpoints: {
    connect: string;
    joinRoom: string;
    heartbeat: string;
    disconnect: string;
    pullEvents: string;
    workspace: string;
    sendMessage: string;
    uploadFile: string;
  };
  identityRules: {
    mustDeclareAgentIdentity: boolean;
    mustNotImpersonateHuman: boolean;
    bridgeOnlyTransportsMessages: boolean;
    privateMemoryRequiresReview: boolean;
  };
  ownerControls: {
    canRevokeToken: boolean;
    canDisconnectSession: boolean;
  };
};

export type BridgeTokenCreateResponse = {
  token: string;
  invite: AgentInvitePackage;
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
  health?: {
    state: "online" | "offline";
    reason: "heartbeat_fresh" | "heartbeat_expired" | "owner_disconnected" | "invalid_timestamps";
    lastSeenSecondsAgo: number | null;
    expiresInSeconds: number | null;
  };
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

export type MemoryCandidateRecord = {
  candidateId: string;
  roomId: string;
  scope: "shared" | "private";
  candidateType: "summary" | "todo" | "blocker" | "decision";
  title: string;
  body: string;
  status: "proposed" | "accepted" | "rejected" | "expired";
  proposedBy: string;
  sourceEventIds: string[];
  sourceMemoryIds: string[];
  targetAgentId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  acceptedInto: Array<"l0" | "l2">;
};

export type SharedKnowledgeRecord = {
  knowledgeId: string;
  spaceId: string;
  roomId: string;
  kind: "decision" | "fact" | "constraint" | "todo";
  title: string;
  body: string;
  keywords: string[];
  sourceCandidateId: string;
  sourceEventIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type WorkMemoryRecord = {
  roomId: string;
  recentMessages: Array<{
    messageId: string;
    speakerParticipantId: string;
    body: string;
    timestamp: string;
  }>;
  activeParticipantIds: string[];
  todoItems: string[];
  blockerItems: string[];
  decisionItems: string[];
  lastSummaryDraftId: string | null;
  updatedAt: string;
};

export type PrivateMemoryOverview = {
  agentId: string;
  roomId: string;
  totalMemories: number;
  shareableMemories: number;
  latestUpdatedAt: string | null;
  latestSourceEventIds: string[];
  suggestedShareCandidate: {
    memoryId: string;
    candidateType: "summary" | "todo" | "blocker" | "decision";
  } | null;
  pendingShareCandidate: {
    candidateId: string;
    memoryId: string;
    candidateType: "summary" | "todo" | "blocker" | "decision";
    submittedAt: string;
  } | null;
  latestShareOutcome: {
    candidateId: string;
    memoryId: string;
    candidateType: "summary" | "todo" | "blocker" | "decision";
    status: "accepted" | "rejected";
    reviewedAt: string | null;
  } | null;
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
    attachments?: AttachmentRecord[];
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
    baseUrl?: string;
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

  async disconnectBridgeSession(id: string): Promise<BridgeSessionRecord> {
    return this.request<BridgeSessionRecord>(`/api/bridge-sessions/${id}/disconnect`, {
      method: "POST"
    });
  }

  async listMemoryCandidates(input: {
    roomId: string;
    scope?: "shared" | "private";
    status?: "proposed" | "accepted" | "rejected" | "expired";
  }): Promise<MemoryCandidateRecord[]> {
    const params = new URLSearchParams({ roomId: input.roomId });
    if (input.scope) {
      params.set("scope", input.scope);
    }
    if (input.status) {
      params.set("status", input.status);
    }

    const response = await this.request<{ items: MemoryCandidateRecord[] }>(
      `/api/memory-candidates?${params.toString()}`
    );
    return response.items;
  }

  async acceptMemoryCandidate(candidateId: string, reviewedBy: string): Promise<MemoryCandidateRecord> {
    return this.request<MemoryCandidateRecord>(`/api/memory-candidates/${candidateId}/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reviewedBy })
    });
  }

  async rejectMemoryCandidate(candidateId: string, reviewedBy: string): Promise<MemoryCandidateRecord> {
    return this.request<MemoryCandidateRecord>(`/api/memory-candidates/${candidateId}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reviewedBy })
    });
  }

  async listSharedKnowledge(input: { roomId: string; spaceId?: string }): Promise<SharedKnowledgeRecord[]> {
    const params = new URLSearchParams({ roomId: input.roomId });
    if (input.spaceId) {
      params.set("spaceId", input.spaceId);
    }

    const response = await this.request<{ items: SharedKnowledgeRecord[] }>(
      `/api/shared-knowledge?${params.toString()}`
    );
    return response.items;
  }

  async listRoomSummaries(roomId: string): Promise<RoomSummaryRecord[]> {
    const params = new URLSearchParams({ roomId });
    const response = await this.request<{ items: RoomSummaryRecord[] }>(
      `/api/room-summaries?${params.toString()}`
    );
    return response.items;
  }

  async getWorkMemory(roomId: string): Promise<WorkMemoryRecord> {
    const params = new URLSearchParams({ roomId });
    return this.request<WorkMemoryRecord>(`/api/work-memory?${params.toString()}`);
  }

  async listPrivateMemoryOverview(roomId: string): Promise<PrivateMemoryOverview[]> {
    const params = new URLSearchParams({ roomId });
    const response = await this.request<{ items: PrivateMemoryOverview[] }>(
      `/api/private-memories/summary?${params.toString()}`
    );
    return response.items;
  }

  async sharePrivateMemoryAsCandidate(input: {
    memoryId: string;
    agentId: string;
    candidateType: "summary" | "todo" | "blocker" | "decision";
  }): Promise<MemoryCandidateRecord> {
    return this.request<MemoryCandidateRecord>(
      `/api/private-memories/${input.memoryId}/share-candidate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId: input.agentId,
          candidateType: input.candidateType
        })
      }
    );
  }
}
