import type { FastifyPluginAsync } from "fastify";

import type { BridgeSessionRecord, BridgeSessionStore } from "../domain/bridges/bridge-session-store";

type BridgeSessionHealth = {
  state: "online" | "offline";
  reason: "heartbeat_fresh" | "heartbeat_expired" | "owner_disconnected" | "invalid_timestamps";
  lastSeenSecondsAgo: number | null;
  expiresInSeconds: number | null;
};

type BridgeSessionsRoutesOptions = {
  bridgeSessionStore: BridgeSessionStore;
  now?: () => Date;
};

function deriveHealth(session: BridgeSessionRecord, now: Date): BridgeSessionHealth {
  const nowMs = now.getTime();
  const expiresAt = Date.parse(session.expiresAt);
  const lastSeenAt = Date.parse(session.lastSeenAt);

  if (Number.isNaN(expiresAt) || Number.isNaN(lastSeenAt)) {
    return {
      state: "offline",
      reason: "invalid_timestamps",
      lastSeenSecondsAgo: null,
      expiresInSeconds: null
    };
  }

  const lastSeenSecondsAgo = Math.round((nowMs - lastSeenAt) / 1000);
  const expiresInSeconds = Math.round((expiresAt - nowMs) / 1000);

  if (session.status === "disconnected" && expiresAt <= lastSeenAt) {
    return {
      state: "offline",
      reason: "owner_disconnected",
      lastSeenSecondsAgo,
      expiresInSeconds
    };
  }

  if (lastSeenAt > expiresAt || expiresAt <= nowMs) {
    return {
      state: "offline",
      reason: "heartbeat_expired",
      lastSeenSecondsAgo,
      expiresInSeconds
    };
  }

  return {
    state: "online",
    reason: "heartbeat_fresh",
    lastSeenSecondsAgo,
    expiresInSeconds
  };
}

function deriveStatus(health: BridgeSessionHealth): BridgeSessionRecord["status"] {
  return health.state === "online" ? "connected" : "disconnected";
}

export const bridgeSessionsRoutes: FastifyPluginAsync<BridgeSessionsRoutesOptions> = async (
  app,
  options
) => {
  const { bridgeSessionStore, now = () => new Date() } = options;

  app.get("/api/bridge-sessions", async () => {
    return {
      items: bridgeSessionStore.list().map((session) => {
        const health = deriveHealth(session, now());

        return {
          ...session,
          status: deriveStatus(health),
          health
        };
      })
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
