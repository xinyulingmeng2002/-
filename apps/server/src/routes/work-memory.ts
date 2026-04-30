import type { FastifyPluginAsync } from "fastify";

import { createEmptyWorkMemory, type WorkMemoryStore } from "../domain/memory/work-memory-store";

type WorkMemoryRoutesOptions = {
  workMemoryStore: WorkMemoryStore;
};

export const workMemoryRoutes: FastifyPluginAsync<WorkMemoryRoutesOptions> = async (
  app,
  options
) => {
  const { workMemoryStore } = options;

  app.get("/api/work-memory", async (request, reply) => {
    const query = request.query as { roomId?: unknown };

    if (typeof query.roomId !== "string" || query.roomId.length === 0) {
      return reply.code(400).send({ error: "roomId is required" });
    }

    return workMemoryStore.get(query.roomId) ?? createEmptyWorkMemory(query.roomId);
  });
};
