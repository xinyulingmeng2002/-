import type { FastifyPluginAsync } from "fastify";

import type { SpaceStore } from "../domain/spaces/space-store";

type SpacesRoutesOptions = {
  spaceStore: SpaceStore;
};

export const spacesRoutes: FastifyPluginAsync<SpacesRoutesOptions> = async (app, options) => {
  const { spaceStore } = options;

  app.get("/api/spaces", async () => {
    return { items: spaceStore.list() };
  });

  app.post("/api/spaces", async (request, reply) => {
    const payload = request.body as { name?: string } | undefined;
    if (!payload?.name) {
      return reply.code(400).send({ error: "name is required" });
    }

    const space = spaceStore.create({ name: payload.name });
    return reply.code(201).send(space);
  });
};
