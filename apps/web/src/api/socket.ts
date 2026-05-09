import { io, type Socket } from "socket.io-client";
import type { MessageEventRecord } from "./client";

export type PresenceParticipant = {
  id: string;
  type: string;
  displayName: string;
};

export type PresencePayload = {
  roomId: string;
  participant: PresenceParticipant;
};

export type MessagePayload = PresencePayload & {
  message: MessageEventRecord;
};

export type RoomSocketClient = {
  joinRoom(payload: PresencePayload): void;
  publishPresence(payload: PresencePayload): void;
  publishMessage(payload: MessagePayload): void;
  onPresence(handler: (payload: PresencePayload) => void): () => void;
  onMessage(handler: (payload: MessagePayload) => void): () => void;
  dispose(): void;
};

export function createRoomSocketClient(baseUrl = ""): RoomSocketClient {
  const socket: Socket = io(baseUrl, {
    autoConnect: false
  });

  socket.connect();

  return {
    joinRoom(payload) {
      socket.emit("room:join", payload);
    },
    publishPresence(payload) {
      socket.emit("room:presence", payload);
    },
    publishMessage(payload) {
      socket.emit("room:message:new", payload);
    },
    onPresence(handler) {
      socket.on("room:presence", handler);
      return () => {
        socket.off("room:presence", handler);
      };
    },
    onMessage(handler) {
      socket.on("room:message:new", handler);
      return () => {
        socket.off("room:message:new", handler);
      };
    },
    dispose() {
      socket.close();
    }
  };
}
