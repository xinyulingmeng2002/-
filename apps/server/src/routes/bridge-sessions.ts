import type { FastifyPluginAsync } from "fastify";

import type { BridgeSessionRecord, BridgeSessionStore } from "../domain/bridges/bridge-session-store";

type BridgeSessionsRoutesOptions = {
  bridgeSessionStore: BridgeSessionStore;
  now?: () => Date;
};

function deriveStatus(
  session: BridgeSessionRecord,
  now: Date
): BridgeSessionRecord["status"] {
  const expiresAt = Date.parse(session.expiresAt);
  const lastSeenAt = Date.parse(session.lastSeenAt);

  if (Number.isNaN(expiresAt) || Number.isNaN(lastSeenAt)) {
    return "disconnected";
  }

  if (lastSeenAt > expiresAt) {
    return "disconnected";
  }

  return expiresAt > now.getTime() ? "connected" : "disconnected";
}

export const bridgeSessionsRoutes: FastifyPluginAsync<BridgeSessionsRoutesOptions> = async (
  app,
  options
) => {
  const { bridgeSessionStore, now = () => new Date() } = options;

  app.get("/api/bridge-sessions", async () => {
    return {
      items: bridgeSessionStore.list().map((session) => ({
        ...session,
        status: deriveStatus(session, now())
      }))
    };
  });

  app.post("/api/bridge-sessions/:id/disconnect", async (request, reply) => {
    const { id } = request.params as { id?: string };
    if (!id) {
      return reply.code(400).send({ error: "id is required" });
    }

    const disconnected = bridgeSessionStore.disconnect({
      id,
      disconnectedAt: now().toISOString()
    });

    if (!disconnected) {
      return reply.code(404).send({ error: "bridge session not found" });
    }

    return disconnected;
  });
};
