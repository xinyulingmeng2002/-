import type { FastifyPluginAsync } from "fastify";

import type { ParticipantStore } from "../domain/participants/participant-store";

type ParticipantsRoutesOptions = {
  participantStore: ParticipantStore;
};

export const participantsRoutes: FastifyPluginAsync<ParticipantsRoutesOptions> = async (
  app,
  options
) => {
  const { participantStore } = options;

  app.get("/api/participants", async () => {
    return { items: participantStore.list() };
  });
};
