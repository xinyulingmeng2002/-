import type { FastifyPluginAsync } from "fastify";

import type { RoomStore } from "../domain/rooms/room-store";

type RoomsRoutesOptions = {
  roomStore: RoomStore;
};

export const roomsRoutes: FastifyPluginAsync<RoomsRoutesOptions> = async (app, options) => {
  const { roomStore } = options;

  app.get("/api/rooms", async (request, reply) => {
    const { spaceId } = request.query as { spaceId?: string };
    if (!spaceId) {
      return reply.code(400).send({ error: "spaceId is required" });
    }

    return { items: roomStore.listBySpace(spaceId) };
  });

  app.post("/api/rooms", async (request, reply) => {
    const payload = request.body as { spaceId?: string; name?: string } | undefined;
    if (!payload?.spaceId || !payload?.name) {
      return reply.code(400).send({ error: "spaceId and name are required" });
    }

    const room = roomStore.create({
      spaceId: payload.spaceId,
      name: payload.name
    });
    return reply.code(201).send(room);
  });
};
