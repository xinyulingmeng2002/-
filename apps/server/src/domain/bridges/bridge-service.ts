import type { RoomEventRecord } from "../messages/event-log-store";
import type { MessageService } from "../messages/message-service";
import type { ParticipantRecord, ParticipantStore } from "../participants/participant-store";
import type { BridgeSessionRecord, BridgeSessionStore } from "./bridge-session-store";
import type { BridgeKind, BridgeTokenStore } from "./bridge-token-store";

const DEFAULT_SESSION_TTL_MS = 2 * 60 * 1000;

type BridgeServiceOptions = {
  bridgeTokenStore: BridgeTokenStore;
  bridgeSessionStore: BridgeSessionStore;
  participantStore: ParticipantStore;
  messageService: MessageService;
  now?: () => Date;
  sessionTtlMs?: number;
};

type ConnectInput = {
  token: string;
  agentId: string;
  displayName?: string;
  capabilities?: string[];
};

type SessionInput = {
  token: string;
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

type PullRoomEventsInput = SessionInput & {
  roomId: string;
  afterEventId?: string;
  limit?: number;
};

type ActiveBridgeToken = {
  id: string;
  bridgeKind: BridgeKind;
  allowedRoomIds: string[];
};

export class BridgeService {
  private readonly bridgeTokenStore: BridgeTokenStore;
  private readonly bridgeSessionStore: BridgeSessionStore;
  private readonly participantStore: ParticipantStore;
  private readonly messageService: MessageService;
  private readonly now: () => Date;
  private readonly sessionTtlMs: number;

  constructor(options: BridgeServiceOptions) {
    this.bridgeTokenStore = options.bridgeTokenStore;
    this.bridgeSessionStore = options.bridgeSessionStore;
    this.participantStore = options.participantStore;
    this.messageService = options.messageService;
    this.now = options.now ?? (() => new Date());
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  }

  connect(input: ConnectInput): { participant: ParticipantRecord; session: BridgeSessionRecord } {
    const bridgeToken = this.authenticate(input.token);
    const participant = this.upsertAgentParticipant({
      agentId: input.agentId,
      displayName: input.displayName,
      bridgeKind: bridgeToken.bridgeKind,
      capabilities: input.capabilities ?? []
    });
    const session = this.bridgeSessionStore.connect({
      tokenId: bridgeToken.id,
      agentId: input.agentId,
      connectedAt: this.timestamp(),
      lastSeenAt: this.timestamp(),
      expiresAt: this.expiresAt()
    });

    return { participant, session };
  }

  heartbeat(input: SessionInput): BridgeSessionRecord {
    const bridgeToken = this.authenticate(input.token);
    const session = this.resolveSession({
      tokenId: bridgeToken.id,
      agentId: input.agentId,
      sessionId: input.sessionId
    });
    const now = this.timestamp();
    const updated = this.bridgeSessionStore.heartbeat({
      id: session.id,
      lastSeenAt: now,
      expiresAt: this.expiresAt()
    });

    if (!updated) {
      throw new Error("bridge_session_not_found");
    }

    const participant = this.participantStore.get(input.agentId);
    if (participant) {
      this.participantStore.upsert({
        ...participant,
        lastSeenAt: now
      });
    }

    return updated;
  }

  disconnect(input: SessionInput): BridgeSessionRecord {
    const bridgeToken = this.authenticate(input.token);
    const session = this.resolveSession({
      tokenId: bridgeToken.id,
      agentId: input.agentId,
      sessionId: input.sessionId
    });
    const now = this.timestamp();
    const disconnected = this.bridgeSessionStore.disconnect({
      id: session.id,
      disconnectedAt: now
    });

    if (!disconnected) {
      throw new Error("bridge_session_not_found");
    }

    const participant = this.participantStore.get(input.agentId);
    if (participant) {
      this.participantStore.upsert({
        ...participant,
        lastSeenAt: now
      });
    }

    return disconnected;
  }

  joinRoom(input: JoinRoomInput): BridgeSessionRecord {
    const bridgeToken = this.authenticate(input.token);
    this.assertRoomAllowed(bridgeToken, input.roomId);
    this.upsertAgentParticipant({
      agentId: input.agentId,
      displayName: input.displayName,
      bridgeKind: bridgeToken.bridgeKind,
      capabilities: input.capabilities ?? []
    });

    const session = this.ensureConnectedSession({
      tokenId: bridgeToken.id,
      agentId: input.agentId,
      sessionId: input.sessionId
    });
    const bound = this.bridgeSessionStore.bindRoom({
      id: session.id,
      roomId: input.roomId
    });

    if (!bound) {
      throw new Error("bridge_session_not_found");
    }

    return bound;
  }

  async sendMessage(input: SendMessageInput): Promise<RoomEventRecord> {
    const session = this.joinRoom(input);
    await this.messageService.appendChatMessage({
      roomId: input.roomId,
      speakerParticipantId: input.agentId,
      body: input.body
    });

    const refreshed = this.bridgeSessionStore.heartbeat({
      id: session.id,
      lastSeenAt: this.timestamp(),
      expiresAt: this.expiresAt()
    });

    if (!refreshed) {
      throw new Error("bridge_session_not_found");
    }

    return this.messageService.listRoomEvents(input.roomId).at(-1) as RoomEventRecord;
  }

  pullRoomEvents(input: PullRoomEventsInput): { items: RoomEventRecord[]; nextCursor: string | null } {
    const bridgeToken = this.authenticate(input.token);
    this.assertRoomAllowed(bridgeToken, input.roomId);
    const session = this.resolveSession({
      tokenId: bridgeToken.id,
      agentId: input.agentId,
      sessionId: input.sessionId
    });

    if (!session.activeRoomIds.includes(input.roomId)) {
      throw new Error("bridge_room_not_joined");
    }

    const refreshed = this.bridgeSessionStore.heartbeat({
      id: session.id,
      lastSeenAt: this.timestamp(),
      expiresAt: this.expiresAt()
    });

    if (!refreshed) {
      throw new Error("bridge_session_not_found");
    }

    const participant = this.participantStore.get(input.agentId);
    if (participant) {
      this.participantStore.upsert({
        ...participant,
        lastSeenAt: refreshed.lastSeenAt
      });
    }

    const items = this.messageService.listRoomEventsAfter(input.roomId, {
      afterEventId: input.afterEventId,
      limit: input.limit
    });

    return {
      items,
      nextCursor: items.at(-1)?.eventId ?? input.afterEventId ?? null
    };
  }

  private authenticate(token: string): ActiveBridgeToken {
    const bridgeToken = this.bridgeTokenStore.findBySecret(token);
    if (!bridgeToken || bridgeToken.revokedAt) {
      throw new Error("bridge_token_invalid");
    }

    return {
      id: bridgeToken.id,
      bridgeKind: bridgeToken.bridgeKind,
      allowedRoomIds: bridgeToken.allowedRoomIds
    };
  }

  private upsertAgentParticipant(input: {
    agentId: string;
    displayName?: string;
    bridgeKind: BridgeKind;
    capabilities: string[];
  }): ParticipantRecord {
    const now = this.timestamp();
    const existing = this.participantStore.get(input.agentId);

    return this.participantStore.upsert({
      id: input.agentId,
      type: "agent",
      displayName: input.displayName ?? existing?.displayName ?? input.agentId,
      bridgeKind: input.bridgeKind,
      capabilities: input.capabilities.length > 0 ? [...input.capabilities] : existing?.capabilities ?? [],
      createdAt: existing?.createdAt ?? now,
      lastSeenAt: now
    });
  }

  private ensureConnectedSession(input: {
    tokenId: string;
    agentId: string;
    sessionId?: string;
  }): BridgeSessionRecord {
    const existing = this.tryResolveSession(input);
    if (existing) {
      const updated = this.bridgeSessionStore.heartbeat({
        id: existing.id,
        lastSeenAt: this.timestamp(),
        expiresAt: this.expiresAt()
      });

      if (!updated) {
        throw new Error("bridge_session_not_found");
      }

      return updated;
    }

    return this.bridgeSessionStore.connect({
      tokenId: input.tokenId,
      agentId: input.agentId,
      connectedAt: this.timestamp(),
      lastSeenAt: this.timestamp(),
      expiresAt: this.expiresAt()
    });
  }

  private resolveSession(input: {
    tokenId: string;
    agentId: string;
    sessionId?: string;
  }): BridgeSessionRecord {
    const session = this.tryResolveSession(input);
    if (!session) {
      throw new Error("bridge_session_not_found");
    }

    return session;
  }

  private tryResolveSession(input: {
    tokenId: string;
    agentId: string;
    sessionId?: string;
  }): BridgeSessionRecord | null {
    if (input.sessionId) {
      return this.bridgeSessionStore.get(input.sessionId);
    }

    return this.bridgeSessionStore.findByTokenAndAgent(input.tokenId, input.agentId);
  }

  private assertRoomAllowed(token: ActiveBridgeToken, roomId: string): void {
    if (!token.allowedRoomIds.includes(roomId)) {
      throw new Error("bridge_room_forbidden");
    }
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private expiresAt(): string {
    return new Date(this.now().getTime() + this.sessionTtlMs).toISOString();
  }
}
