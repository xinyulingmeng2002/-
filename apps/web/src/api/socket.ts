import { io, type Socket } from "socket.io-client";

type PresenceParticipant = {
  id: string;
  type: string;
  displayName: string;
};

type PresencePayload = {
  roomId: string;
  participant: PresenceParticipant;
};

type MessagePayload = PresencePayload & {
  message: unknown;
};

export type RoomSocketClient = {
  joinRoom(payload: PresencePayload): void;
  publishPresence(payload: PresencePayload): void;
  publishMessage(payload: MessagePayload): void;
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
    dispose() {
      socket.close();
    }
  };
}
