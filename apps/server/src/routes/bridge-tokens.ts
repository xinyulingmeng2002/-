import type { FastifyPluginAsync } from "fastify";

import { isBridgeKind, type BridgeTokenStore } from "../domain/bridges/bridge-token-store";

type BridgeTokensRoutesOptions = {
  bridgeTokenStore: BridgeTokenStore;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function resolveBaseUrl(
  request: { headers: { host?: string | string[] }; protocol: string },
  explicitBaseUrl?: string
): string {
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, "");
  }

  const host = Array.isArray(request.headers.host) ? request.headers.host[0] : request.headers.host;
  return `${request.protocol}://${host ?? "localhost:80"}`;
}

function buildAgentInvite(input: {
  label: string;
  bridgeKind: "codex" | "openclaw" | "generic";
  roomIds: string[];
  baseUrl: string;
  token: string;
}) {
  return {
    type: "multi-agent-room-invite",
    version: "1",
    label: input.label,
    bridgeKind: input.bridgeKind,
    roomIds: input.roomIds,
    primaryRoomId: input.roomIds[0] ?? null,
    baseUrl: input.baseUrl,
    token: input.token,
    endpoints: {
      connect: "/api/bridge/ingress/connect",
      joinRoom: "/api/bridge/ingress/join-room",
      heartbeat: "/api/bridge/ingress/heartbeat",
      disconnect: "/api/bridge/ingress/disconnect",
      pullEvents: "/api/bridge/egress/events",
      workspace: "/api/bridge/egress/workspace",
      sendMessage: "/api/bridge/ingress/message",
      uploadFile: "/api/uploads"
    },
    identityRules: {
      mustDeclareAgentIdentity: true,
      mustNotImpersonateHuman: true,
      bridgeOnlyTransportsMessages: true,
      privateMemoryRequiresReview: true
    },
    ownerControls: {
      canRevokeToken: true,
      canDisconnectSession: true
    }
  };
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
      | { label?: string; bridgeKind?: string; allowedRoomIds?: unknown; baseUrl?: unknown }
      | undefined;

    if (
      !payload?.label ||
      !isBridgeKind(payload.bridgeKind) ||
      (payload.allowedRoomIds !== undefined && !isStringArray(payload.allowedRoomIds)) ||
      (payload.baseUrl !== undefined && typeof payload.baseUrl !== "string")
    ) {
      return reply
        .code(400)
        .send({ error: "label, bridgeKind, allowedRoomIds[], and optional baseUrl are required" });
    }

    const created = bridgeTokenStore.create({
      label: payload.label,
      bridgeKind: payload.bridgeKind,
      allowedRoomIds: payload.allowedRoomIds ?? []
    });

    return reply.code(201).send({
      ...created,
      invite: buildAgentInvite({
        label: created.metadata.label,
        bridgeKind: created.metadata.bridgeKind,
        roomIds: created.metadata.allowedRoomIds,
        baseUrl: resolveBaseUrl(request, payload.baseUrl),
        token: created.token
      })
    });
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
