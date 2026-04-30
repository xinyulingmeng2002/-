import type { FastifyPluginAsync } from "fastify";

import type { SharedKnowledgeStore } from "../domain/memory/shared-knowledge-store";

type SharedKnowledgeRoutesOptions = {
  sharedKnowledgeStore: SharedKnowledgeStore;
};

export const sharedKnowledgeRoutes: FastifyPluginAsync<SharedKnowledgeRoutesOptions> = async (
  app,
  options
) => {
  const { sharedKnowledgeStore } = options;

  app.get("/api/shared-knowledge", async (request, reply) => {
    const query = request.query as { roomId?: unknown; spaceId?: unknown };

    if (query.roomId !== undefined && typeof query.roomId !== "string") {
      return reply.code(400).send({ error: "roomId must be a string" });
    }
    if (query.spaceId !== undefined && typeof query.spaceId !== "string") {
      return reply.code(400).send({ error: "spaceId must be a string" });
    }

    return {
      items: sharedKnowledgeStore.list({
        roomId: query.roomId as string | undefined,
        spaceId: query.spaceId as string | undefined
      })
    };
  });
};
