import { useEffect, useRef, useState } from "react";

import {
  ApiClient,
  type BridgeSessionRecord,
  type BridgeTokenCreateResponse,
  type BridgeTokenRecord,
  type MessageEventRecord,
  type ParticipantRecord,
  type RoomRecord,
  type RoomSummaryRecord,
  type UploadAttachmentResponse
} from "../../api/client";
import {
  createRoomSocketClient,
  type PresenceParticipant,
  type RoomSocketClient
} from "../../api/socket";
import { AgentPanel } from "../agents/agent-panel";
import { MessageComposer, type MessageComposerSubmit } from "../chat/message-composer";
import { MessageList, type TimelineMessage } from "../chat/message-list";
import { ParticipantList, type ParticipantViewModel } from "../participants/participant-list";
import { RoomList } from "./room-list";

type RoomShellProps = {
  apiClient: ApiClient;
  speakerParticipantId?: string;
  createSocketClient?: (baseUrl?: string) => RoomSocketClient;
};

type AgentPanelData = {
  directoryParticipants: ParticipantRecord[];
  bridgeSessions: BridgeSessionRecord[];
  bridgeTokens: BridgeTokenRecord[];
  roomSummaries: RoomSummaryRecord[];
};

const DEFAULT_SPACE_ID = "space-default";
const DEFAULT_ROOM_NAME = "主协作间";
const DEFAULT_SPEAKER_PARTICIPANT_ID = "human-1";

function normalizeEvent(event: MessageEventRecord): TimelineMessage {
  return {
    id: event.payload.messageId ?? event.eventId,
    kind: event.kind === "message.created" ? "chat" : "system",
    body: event.payload.body ?? "",
    speakerParticipantId: event.payload.speakerParticipantId ?? "system",
    timestamp: event.timestamp,
    attachments: event.payload.attachments
  };
}

function createSystemMessage(id: string, body: string): TimelineMessage {
  return {
    id,
    kind: "system",
    body,
    speakerParticipantId: "system",
    timestamp: new Date().toISOString()
  };
}

function createParticipantIdentity(participantId: string): PresenceParticipant {
  return {
    id: participantId,
    type: inferParticipantType(participantId),
    displayName: getParticipantDisplayName(participantId)
  };
}

function mergeTimelineMessages(
  current: TimelineMessage[],
  incoming: TimelineMessage
): TimelineMessage[] {
  if (current.some((message) => message.id === incoming.id)) {
    return current;
  }

  return [...current, incoming];
}

function toParticipantViewModel(participant: PresenceParticipant): ParticipantViewModel {
  return {
    id: participant.id,
    displayName: participant.displayName,
    type: participant.type === "human" ? "human" : "agent"
  };
}

function mergeParticipants(
  current: ParticipantViewModel[],
  incoming: ParticipantViewModel
): ParticipantViewModel[] {
  const existingIndex = current.findIndex((participant) => participant.id === incoming.id);
  if (existingIndex === -1) {
    return [...current, incoming];
  }

  const next = [...current];
  next[existingIndex] = incoming;
  return next;
}

function inferParticipantType(participantId: string): ParticipantViewModel["type"] {
  if (participantId.startsWith("agent-") || participantId === "system") {
    return "agent";
  }

  return "human";
}

function getParticipantDisplayName(participantId: string): string {
  if (participantId === "human-1") {
    return "你";
  }
  if (participantId === "system") {
    return "系统";
  }

  return participantId;
}

async function loadAgentPanelData(apiClient: ApiClient, roomId: string): Promise<AgentPanelData> {
  const [directoryParticipants, bridgeSessions, bridgeTokens, roomSummaries] = await Promise.all([
    apiClient.listParticipants(),
    apiClient.listBridgeSessions(),
    apiClient.listBridgeTokens(),
    apiClient.listRoomSummaries(roomId)
  ]);

  return {
    directoryParticipants,
    bridgeSessions,
    bridgeTokens,
    roomSummaries
  };
}

function buildParticipants(
  room: RoomRecord | undefined,
  messages: TimelineMessage[],
  speakerParticipantId: string,
  realtimeParticipants: ParticipantViewModel[],
  directoryParticipants: ParticipantRecord[],
  bridgeSessions: BridgeSessionRecord[],
  activeRoomId: string
): ParticipantViewModel[] {
  const seen = new Set<string>([speakerParticipantId, "agent-observer"]);
  const nextParticipants = [...realtimeParticipants];
  const participantDirectory = new Map(directoryParticipants.map((participant) => [participant.id, participant]));

  for (const participantId of room?.participantIds ?? []) {
    seen.add(participantId);
  }
  for (const message of messages) {
    seen.add(message.speakerParticipantId);
  }
  for (const session of bridgeSessions) {
    if (session.status === "connected" && session.activeRoomIds.includes(activeRoomId)) {
      seen.add(session.agentId);
    }
  }

  for (const participantId of Array.from(seen)) {
    const record = participantDirectory.get(participantId);
    nextParticipants.push({
      id: participantId,
      displayName:
        participantId === "agent-observer"
          ? "Observer"
          : record?.displayName ?? getParticipantDisplayName(participantId),
      type:
        participantId === "agent-observer"
          ? "agent"
          : record?.type === "human"
            ? "human"
            : inferParticipantType(participantId)
    });
  }

  const deduped = new Map<string, ParticipantViewModel>();
  for (const participant of nextParticipants) {
    deduped.set(participant.id, participant);
  }

  return [...deduped.values()];
}

export function RoomShell({
  apiClient,
  speakerParticipantId = DEFAULT_SPEAKER_PARTICIPANT_ID,
  createSocketClient = createRoomSocketClient
}: RoomShellProps) {
  const [statusText, setStatusText] = useState("正在连接协作空间…");
  const [errorText, setErrorText] = useState("");
  const [panelErrorText, setPanelErrorText] = useState("");
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [messages, setMessages] = useState<TimelineMessage[]>([]);
  const [realtimeParticipants, setRealtimeParticipants] = useState<ParticipantViewModel[]>([]);
  const [directoryParticipants, setDirectoryParticipants] = useState<ParticipantRecord[]>([]);
  const [bridgeSessions, setBridgeSessions] = useState<BridgeSessionRecord[]>([]);
  const [bridgeTokens, setBridgeTokens] = useState<BridgeTokenRecord[]>([]);
  const [roomSummaries, setRoomSummaries] = useState<RoomSummaryRecord[]>([]);
  const socketClientRef = useRef<RoomSocketClient | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const spaces = await apiClient.listSpaces();
        const activeSpaceId = spaces[0]?.id ?? DEFAULT_SPACE_ID;
        let nextRooms = await apiClient.listRooms(activeSpaceId);

        if (nextRooms.length === 0) {
          nextRooms = [await apiClient.createRoom({ spaceId: activeSpaceId, name: DEFAULT_ROOM_NAME })];
        }

        if (cancelled) {
          return;
        }

        setRooms(nextRooms);
        setActiveRoomId((current) => {
          if (current && nextRooms.some((room) => room.id === current)) {
            return current;
          }

          return nextRooms[0]?.id ?? "";
        });
        setStatusText("已接入默认协作空间");
        setErrorText("");
      } catch {
        if (cancelled) {
          return;
        }

        const fallbackRoom: RoomRecord = {
          id: "room-offline",
          spaceId: DEFAULT_SPACE_ID,
          name: "离线房间",
          participantIds: []
        };

        setRooms([fallbackRoom]);
        setActiveRoomId(fallbackRoom.id);
        setMessages([createSystemMessage("offline", "服务端暂不可达，当前为离线浏览模式。")]);
        setStatusText("离线模式");
        setErrorText("未能连接到服务端，稍后重试。");
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  useEffect(() => {
    if (!activeRoomId || activeRoomId === "room-offline") {
      return;
    }

    let cancelled = false;

    async function loadMessages() {
      try {
        const events = await apiClient.listMessages(activeRoomId);
        if (cancelled) {
          return;
        }

        setMessages(events.map(normalizeEvent));
        setErrorText("");
      } catch {
        if (!cancelled) {
          setErrorText("消息流加载失败。");
        }
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeRoomId, apiClient]);

  useEffect(() => {
    if (!activeRoomId || activeRoomId === "room-offline") {
      setDirectoryParticipants([]);
      setBridgeSessions([]);
      setBridgeTokens([]);
      setRoomSummaries([]);
      return;
    }

    let cancelled = false;

    async function loadPanel() {
      try {
        const data = await loadAgentPanelData(apiClient, activeRoomId);
        if (cancelled) {
          return;
        }

        setDirectoryParticipants(data.directoryParticipants);
        setBridgeSessions(data.bridgeSessions);
        setBridgeTokens(data.bridgeTokens);
        setRoomSummaries(data.roomSummaries);
        setPanelErrorText("");
      } catch {
        if (!cancelled) {
          setPanelErrorText("接入面板加载失败。");
        }
      }
    }

    void loadPanel();

    return () => {
      cancelled = true;
    };
  }, [activeRoomId, apiClient]);

  useEffect(() => {
    setRealtimeParticipants([]);
  }, [activeRoomId]);

  useEffect(() => {
    if (!activeRoomId || activeRoomId === "room-offline") {
      socketClientRef.current?.dispose();
      socketClientRef.current = null;
      return;
    }

    if (import.meta.env.MODE === "test" && createSocketClient === createRoomSocketClient) {
      return;
    }

    const selfParticipant = createParticipantIdentity(speakerParticipantId);
    const socketClient = createSocketClient(import.meta.env.VITE_SERVER_ORIGIN ?? "");
    socketClientRef.current = socketClient;
    setRealtimeParticipants((current) =>
      mergeParticipants(current, toParticipantViewModel(selfParticipant))
    );

    const offPresence = socketClient.onPresence((payload) => {
      if (payload.roomId !== activeRoomId) {
        return;
      }

      setRealtimeParticipants((current) =>
        mergeParticipants(current, toParticipantViewModel(payload.participant))
      );
    });
    const offMessage = socketClient.onMessage((payload) => {
      if (payload.roomId !== activeRoomId) {
        return;
      }

      setRealtimeParticipants((current) =>
        mergeParticipants(current, toParticipantViewModel(payload.participant))
      );
      setMessages((current) => mergeTimelineMessages(current, normalizeEvent(payload.message)));
    });

    socketClient.joinRoom({
      roomId: activeRoomId,
      participant: selfParticipant
    });

    return () => {
      offPresence();
      offMessage();
      socketClient.dispose();
      if (socketClientRef.current === socketClient) {
        socketClientRef.current = null;
      }
    };
  }, [activeRoomId, createSocketClient, speakerParticipantId]);

  const activeRoom = rooms.find((room) => room.id === activeRoomId);
  const participants = buildParticipants(
    activeRoom,
    messages,
    speakerParticipantId,
    realtimeParticipants,
    directoryParticipants,
    bridgeSessions,
    activeRoomId
  );
  const latestSummary = roomSummaries.at(-1) ?? null;

  async function refreshAgentPanel(roomId = activeRoomId) {
    if (!roomId || roomId === "room-offline") {
      return;
    }

    const data = await loadAgentPanelData(apiClient, roomId);
    setDirectoryParticipants(data.directoryParticipants);
    setBridgeSessions(data.bridgeSessions);
    setBridgeTokens(data.bridgeTokens);
    setRoomSummaries(data.roomSummaries);
    setPanelErrorText("");
  }

  async function handleSend(input: MessageComposerSubmit) {
    if (!activeRoomId) {
      return;
    }

    if (activeRoomId === "room-offline") {
      setMessages((current) => [
        ...current,
        {
          id: `offline-${Date.now()}`,
          kind: "chat",
          body: input.body,
          speakerParticipantId: input.speakerParticipantId,
          timestamp: new Date().toISOString()
        }
      ]);
      return;
    }

    const event = await apiClient.createMessage({
      roomId: activeRoomId,
      speakerParticipantId: input.speakerParticipantId,
      body: input.body
    });

    const normalizedEvent = normalizeEvent(event);

    setMessages((current) => mergeTimelineMessages(current, normalizedEvent));
    socketClientRef.current?.publishMessage({
      roomId: activeRoomId,
      participant: createParticipantIdentity(input.speakerParticipantId),
      message: event
    });
    await refreshAgentPanel(activeRoomId);
  }

  async function handleUpload(response: UploadAttachmentResponse) {
    if (!activeRoomId || activeRoomId === "room-offline") {
      return;
    }

    const event = await apiClient.createMessage({
      roomId: activeRoomId,
      speakerParticipantId,
      body: "",
      attachments: [response.attachment]
    });

    const normalizedEvent = normalizeEvent(event);
    setMessages((current) => mergeTimelineMessages(current, normalizedEvent));
    socketClientRef.current?.publishMessage({
      roomId: activeRoomId,
      participant: createParticipantIdentity(speakerParticipantId),
      message: event
    });
    await refreshAgentPanel(activeRoomId);
  }

  async function handleCreateToken(input: {
    label: string;
    bridgeKind: "codex" | "openclaw" | "generic";
    allowedRoomIds: string[];
  }): Promise<BridgeTokenCreateResponse> {
    const created = await apiClient.createBridgeToken(input);
    await refreshAgentPanel(activeRoomId);
    return created;
  }

  async function handleRevokeToken(id: string): Promise<void> {
    await apiClient.revokeBridgeToken(id);
    await refreshAgentPanel(activeRoomId);
  }

  return (
    <div className="app-shell">
      <aside className="app-panel app-panel--rooms">
        <div className="panel-header">
          <span className="panel-eyebrow">Space</span>
          <h1>房间</h1>
          <p className="panel-caption">{statusText}</p>
        </div>
        <div className="panel-body panel-body--scroll">
          <RoomList rooms={rooms} activeRoomId={activeRoomId} onSelect={setActiveRoomId} />
        </div>
      </aside>

      <main className="app-panel app-panel--messages">
        <div className="panel-header">
          <span className="panel-eyebrow">Timeline</span>
          <h2>消息</h2>
          <p className="panel-caption">{activeRoom?.name ?? "准备中"}</p>
        </div>
        <div className="panel-body panel-body--stack">
          {errorText ? <div className="status-banner">{errorText}</div> : null}
          {latestSummary ? (
            <div className="summary-card">
              <strong>最新摘要</strong>
              <p>{latestSummary.summaryText}</p>
              <span>
                {latestSummary.messageCount} 条消息 · {latestSummary.participantCount} 位参与者
              </span>
            </div>
          ) : null}
          <MessageList messages={messages} />
          <MessageComposer
            speakerParticipantId={speakerParticipantId}
            onSend={handleSend}
            onUpload={handleUpload}
            uploadFile={(file) => apiClient.uploadFile(file)}
            disabled={!activeRoomId}
          />
        </div>
      </main>

      <aside className="app-panel app-panel--participants">
        <div className="panel-header">
          <span className="panel-eyebrow">Presence</span>
          <h2>参与者</h2>
          <p className="panel-caption">房间参与者、bridge 会话、token 与摘要</p>
        </div>
        <div className="panel-body panel-body--scroll panel-body--stack">
          {panelErrorText ? <div className="status-banner">{panelErrorText}</div> : null}
          <ParticipantList participants={participants} />
          <AgentPanel
            activeRoomId={activeRoomId}
            participants={directoryParticipants}
            sessions={bridgeSessions}
            tokens={bridgeTokens}
            latestSummary={latestSummary}
            onCreateToken={handleCreateToken}
            onRevokeToken={handleRevokeToken}
          />
        </div>
      </aside>
    </div>
  );
}
