import type { FastifyPluginAsync } from "fastify";

import { isBridgeKind, type BridgeTokenStore } from "../domain/bridges/bridge-token-store";

type BridgeTokensRoutesOptions = {
  bridgeTokenStore: BridgeTokenStore;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export const bridgeTokensRoutes: FastifyPluginAsync<BridgeTokensRoutesOptions> = async (
  app,
  options
) => {
  const { bridgeTokenStore } = options;

  app.get("/api/bridge-tokens", async () => {
    return { items: bridgeTokenStore.list() };
  });

  app.post("/api/bridge-tokens", async (request, reply) => {
    const payload = request.body as
      | { label?: string; bridgeKind?: string; allowedRoomIds?: unknown }
      | undefined;

    if (
      !payload?.label ||
      !isBridgeKind(payload.bridgeKind) ||
      (payload.allowedRoomIds !== undefined && !isStringArray(payload.allowedRoomIds))
    ) {
      return reply
        .code(400)
        .send({ error: "label, bridgeKind, and allowedRoomIds[] are required" });
    }

    const created = bridgeTokenStore.create({
      label: payload.label,
      bridgeKind: payload.bridgeKind,
      allowedRoomIds: payload.allowedRoomIds ?? []
    });

    return reply.code(201).send(created);
  });

  app.post("/api/bridge-tokens/:id/revoke", async (request, reply) => {
    const { id } = request.params as { id?: string };
    if (!id) {
      return reply.code(400).send({ error: "id is required" });
    }

    const revoked = bridgeTokenStore.revoke(id);
    if (!revoked) {
      return reply.code(404).send({ error: "bridge token not found" });
    }

    return revoked;
  });
};
