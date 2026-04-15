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
}
