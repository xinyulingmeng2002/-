import type { FastifyPluginAsync } from "fastify";

import type { RoomSummaryStore } from "../domain/memory/room-summary-store";

type RoomSummariesRoutesOptions = {
  roomSummaryStore: RoomSummaryStore;
};

export const roomSummariesRoutes: FastifyPluginAsync<RoomSummariesRoutesOptions> = async (
  app,
  options
) => {
  const { roomSummaryStore } = options;

  app.get("/api/room-summaries", async (request, reply) => {
    const roomId = (request.query as { roomId?: unknown }).roomId;
    if (typeof roomId !== "string" || roomId.length === 0) {
      return reply.code(400).send({ error: "roomId is required" });
    }

    return { items: roomSummaryStore.list(roomId) };
  });
};
