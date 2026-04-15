import { useEffect, useState } from "react";

import {
  ApiClient,
  type MessageEventRecord,
  type RoomRecord,
  type UploadAttachmentResponse
} from "../../api/client";
import { MessageComposer, type MessageComposerSubmit } from "../chat/message-composer";
import { MessageList, type TimelineMessage } from "../chat/message-list";
import { ParticipantList, type ParticipantViewModel } from "../participants/participant-list";
import { RoomList } from "./room-list";

type RoomShellProps = {
  apiClient: ApiClient;
  speakerParticipantId?: string;
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
    timestamp: event.timestamp
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

function buildParticipants(
  room: RoomRecord | undefined,
  messages: TimelineMessage[],
  speakerParticipantId: string
): ParticipantViewModel[] {
  const seen = new Set<string>([speakerParticipantId, "agent-observer"]);

  for (const participantId of room?.participantIds ?? []) {
    seen.add(participantId);
  }
  for (const message of messages) {
    seen.add(message.speakerParticipantId);
  }

  return Array.from(seen).map((participantId) => ({
    id: participantId,
    displayName: participantId === "agent-observer" ? "Observer" : getParticipantDisplayName(participantId),
    type: participantId === "agent-observer" ? "agent" : inferParticipantType(participantId)
  }));
}

export function RoomShell({
  apiClient,
  speakerParticipantId = DEFAULT_SPEAKER_PARTICIPANT_ID
}: RoomShellProps) {
  const [statusText, setStatusText] = useState("正在连接协作空间…");
  const [errorText, setErrorText] = useState("");
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [messages, setMessages] = useState<TimelineMessage[]>([]);

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

  const activeRoom = rooms.find((room) => room.id === activeRoomId);
  const participants = buildParticipants(activeRoom, messages, speakerParticipantId);

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

    setMessages((current) => [...current, normalizeEvent(event)]);
  }

  function handleUpload(response: UploadAttachmentResponse) {
    setMessages((current) => [
      ...current,
      createSystemMessage(
        `upload-${response.attachment.id}`,
        `已上传 ${response.originalName}，可通过 ${response.attachment.url} 访问。`
      )
    ]);
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
          <p className="panel-caption">人类与智能体按角色分区</p>
        </div>
        <div className="panel-body panel-body--scroll">
          <ParticipantList participants={participants} />
        </div>
      </aside>
    </div>
  );
}
