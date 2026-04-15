import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";

export interface RoomParticipantIdentity {
  id: string;
  type: string;
  displayName: string;
}

export interface RoomPresencePayload {
  roomId: string;
  participant: RoomParticipantIdentity;
}

export interface RoomMessagePayload extends RoomPresencePayload {
  message: unknown;
}

function isParticipant(value: unknown): value is RoomParticipantIdentity {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RoomParticipantIdentity>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.displayName === "string"
  );
}

function isPresencePayload(value: unknown): value is RoomPresencePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RoomPresencePayload>;
  return typeof candidate.roomId === "string" && isParticipant(candidate.participant);
}

function isMessagePayload(value: unknown): value is RoomMessagePayload {
  if (!isPresencePayload(value)) {
    return false;
  }

  return "message" in value;
}

export function registerRoomRealtimeGateway(app: FastifyInstance): Server {
  const io = new Server(app.server);

  io.on("connection", (socket) => {
    socket.on("room:join", (payload: unknown) => {
      if (!isPresencePayload(payload)) {
        return;
      }

      socket.join(payload.roomId);
      io.to(payload.roomId).emit("room:presence", payload);
    });

    socket.on("room:presence", (payload: unknown) => {
      if (!isPresencePayload(payload)) {
        return;
      }
      if (!socket.rooms.has(payload.roomId)) {
        return;
      }

      io.to(payload.roomId).emit("room:presence", payload);
    });

    socket.on("room:message:new", (payload: unknown) => {
      if (!isMessagePayload(payload)) {
        return;
      }
      if (!socket.rooms.has(payload.roomId)) {
        return;
      }

      io.to(payload.roomId).emit("room:message:new", payload);
    });
  });

  app.addHook("onClose", async () => {
    await io.close();
  });

  return io;
}
