import type {
  AttachmentRecord,
  MemoryCandidateRecord,
  MessageEventRecord,
  PrivateMemoryOverview,
  RoomSummaryRecord,
  SharedKnowledgeRecord,
  UploadAttachmentResponse,
  WorkMemoryRecord
} from "../../api/client";

export type BridgeWorkspaceParticipant = {
  id: string;
  type: "human" | "agent" | "bridge" | "system";
  displayName: string;
  bridgeKind: "codex" | "openclaw" | "generic" | null;
  capabilities: string[];
  lastSeenAt: string;
};

export type BridgeWorkspaceSnapshot = {
  agent: {
    id: string;
    displayName: string;
    capabilities: string[];
  };
  session: {
    id: string;
    activeRoomIds: string[];
    lastSeenAt: string;
    expiresAt: string;
  };
  room: {
    id: string;
  };
  participants: BridgeWorkspaceParticipant[];
  latestSummary: RoomSummaryRecord | null;
  workMemory: WorkMemoryRecord | null;
  sharedKnowledge: SharedKnowledgeRecord[];
  memoryCandidates: MemoryCandidateRecord[];
  recentEvents: MessageEventRecord[];
  nextCursor: string | null;
};

export type BridgeWorkspaceEventBatch = {
  items: MessageEventRecord[];
  nextCursor: string | null;
};

export type BridgeWorkspaceRequest = {
  baseUrl: string;
  bridgeToken: string;
  agentId: string;
  sessionId: string;
  roomId: string;
};

export type BridgeWorkspaceSnapshotRequest = BridgeWorkspaceRequest & {
  eventLimit?: number;
};

export type BridgeWorkspaceEventsRequest = BridgeWorkspaceRequest & {
  afterEventId?: string;
  limit?: number;
};

export type BridgeWorkspaceMessageRequest = BridgeWorkspaceRequest & {
  body: string;
  attachments?: AttachmentRecord[];
};

export type BridgeWorkspaceFileUploadRequest = {
  baseUrl: string;
  file: File;
};

export type BridgeWorkspacePrivateMemoryOverviewRequest = {
  baseUrl: string;
  roomId: string;
};

export type BridgeWorkspacePrivateMemoryShareRequest = {
  baseUrl: string;
  memoryId: string;
  agentId: string;
  candidateType: "summary" | "todo" | "blocker" | "decision";
};

async function requestJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`bridge_workspace_request_failed:${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchBridgeWorkspaceSnapshot(
  input: BridgeWorkspaceSnapshotRequest
): Promise<BridgeWorkspaceSnapshot> {
  const params = new URLSearchParams({
    agentId: input.agentId,
    sessionId: input.sessionId,
    roomId: input.roomId
  });

  if (typeof input.eventLimit === "number") {
    params.set("eventLimit", String(input.eventLimit));
  }

  return requestJson<BridgeWorkspaceSnapshot>(
    `${input.baseUrl}/api/bridge/egress/workspace?${params.toString()}`,
    input.bridgeToken
  );
}

export async function fetchBridgeWorkspaceEvents(
  input: BridgeWorkspaceEventsRequest
): Promise<BridgeWorkspaceEventBatch> {
  const params = new URLSearchParams({
    agentId: input.agentId,
    sessionId: input.sessionId,
    roomId: input.roomId
  });

  if (input.afterEventId) {
    params.set("afterEventId", input.afterEventId);
  }
  if (typeof input.limit === "number") {
    params.set("limit", String(input.limit));
  }

  return requestJson<BridgeWorkspaceEventBatch>(
    `${input.baseUrl}/api/bridge/egress/events?${params.toString()}`,
    input.bridgeToken
  );
}

export async function sendBridgeWorkspaceMessage(
  input: BridgeWorkspaceMessageRequest
): Promise<MessageEventRecord> {
  const response = await fetch(`${input.baseUrl}/api/bridge/ingress/message`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.bridgeToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      agentId: input.agentId,
      sessionId: input.sessionId,
      roomId: input.roomId,
      body: input.body,
      attachments: input.attachments
    })
  });

  if (!response.ok) {
    throw new Error(`bridge_workspace_request_failed:${response.status}`);
  }

  return (await response.json()) as MessageEventRecord;
}

export async function uploadBridgeWorkspaceFile(
  input: BridgeWorkspaceFileUploadRequest
): Promise<UploadAttachmentResponse> {
  const formData = new FormData();
  formData.append("file", input.file);

  const response = await fetch(`${input.baseUrl}/api/uploads`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error(`bridge_workspace_request_failed:${response.status}`);
  }

  return (await response.json()) as UploadAttachmentResponse;
}

export async function fetchBridgeWorkspacePrivateMemoryOverview(
  input: BridgeWorkspacePrivateMemoryOverviewRequest
): Promise<PrivateMemoryOverview[]> {
  const params = new URLSearchParams({
    roomId: input.roomId
  });

  const response = await fetch(`${input.baseUrl}/api/private-memories/summary?${params.toString()}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`bridge_workspace_request_failed:${response.status}`);
  }

  const body = (await response.json()) as { items: PrivateMemoryOverview[] };
  return body.items;
}

export async function shareBridgeWorkspacePrivateMemory(
  input: BridgeWorkspacePrivateMemoryShareRequest
): Promise<MemoryCandidateRecord> {
  const response = await fetch(`${input.baseUrl}/api/private-memories/${input.memoryId}/share-candidate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      agentId: input.agentId,
      candidateType: input.candidateType
    })
  });

  if (!response.ok) {
    throw new Error(`bridge_workspace_request_failed:${response.status}`);
  }

  return (await response.json()) as MemoryCandidateRecord;
}
