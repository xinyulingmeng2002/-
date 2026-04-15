import type { FastifyPluginAsync } from "fastify";

import { isSafeRoomId } from "../domain/messages/event-log-store";
import { BridgeService } from "../domain/bridges/bridge-service";

type BridgeIngressRoutesOptions = {
  bridgeService: BridgeService;
};

function getBearerToken(authorization: unknown): string | null {
  if (typeof authorization !== "string") {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function sendBridgeError(reply: { code: (statusCode: number) => { send: (body: unknown) => unknown } }, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message === "bridge_token_invalid") {
    return reply.code(401).send({ error: "bridge token is invalid" });
  }

  if (message === "bridge_room_forbidden") {
    return reply.code(403).send({ error: "bridge token cannot access this room" });
  }

  if (message === "bridge_session_not_found") {
    return reply.code(404).send({ error: "bridge session not found" });
  }

  return reply.code(500).send({ error: "bridge ingress failed" });
}

export const bridgeIngressRoutes: FastifyPluginAsync<BridgeIngressRoutesOptions> = async (
  app,
  options
) => {
  const { bridgeService } = options;

  app.post("/api/bridge/ingress/connect", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    const payload = request.body as
      | { agentId?: unknown; displayName?: unknown; capabilities?: unknown }
      | undefined;

    if (
      !token ||
      typeof payload?.agentId !== "string" ||
      (payload.displayName !== undefined && typeof payload.displayName !== "string") ||
      (payload.capabilities !== undefined &&
        (!Array.isArray(payload.capabilities) ||
          payload.capabilities.some((item) => typeof item !== "string")))
    ) {
      return reply
        .code(400)
        .send({ error: "authorization, agentId, and optional displayName/capabilities are required" });
    }

    try {
      const result = bridgeService.connect({
        token,
        agentId: payload.agentId,
        displayName: payload.displayName,
        capabilities: (payload.capabilities as string[] | undefined) ?? []
      });

      return reply.code(201).send(result);
    } catch (error) {
      return sendBridgeError(reply, error);
    }
  });

  app.post("/api/bridge/ingress/heartbeat", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    const payload = request.body as { sessionId?: unknown; agentId?: unknown } | undefined;

    if (!token || typeof payload?.agentId !== "string") {
      return reply.code(400).send({ error: "authorization and agentId are required" });
    }

    try {
      const session = bridgeService.heartbeat({
        token,
        sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
        agentId: payload.agentId
      });

      return session;
    } catch (error) {
      return sendBridgeError(reply, error);
    }
  });

  app.post("/api/bridge/ingress/disconnect", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    const payload = request.body as { sessionId?: unknown; agentId?: unknown } | undefined;

    if (!token || typeof payload?.agentId !== "string") {
      return reply.code(400).send({ error: "authorization and agentId are required" });
    }

    try {
      const session = bridgeService.disconnect({
        token,
        sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
        agentId: payload.agentId
      });

      return session;
    } catch (error) {
      return sendBridgeError(reply, error);
    }
  });

  app.post("/api/bridge/ingress/join-room", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    const payload = request.body as
      | { sessionId?: unknown; agentId?: unknown; roomId?: unknown; displayName?: unknown; capabilities?: unknown }
      | undefined;

    if (
      !token ||
      typeof payload?.agentId !== "string" ||
      typeof payload.roomId !== "string" ||
      !isSafeRoomId(payload.roomId) ||
      (payload.displayName !== undefined && typeof payload.displayName !== "string") ||
      (payload.capabilities !== undefined &&
        (!Array.isArray(payload.capabilities) ||
          payload.capabilities.some((item) => typeof item !== "string")))
    ) {
      return reply
        .code(400)
        .send({ error: "authorization, agentId, safe roomId, and optional displayName/capabilities are required" });
    }

    try {
      const session = bridgeService.joinRoom({
        token,
        sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
        agentId: payload.agentId,
        roomId: payload.roomId,
        displayName: payload.displayName as string | undefined,
        capabilities: (payload.capabilities as string[] | undefined) ?? []
      });

      return session;
    } catch (error) {
      return sendBridgeError(reply, error);
    }
  });

  app.post("/api/bridge/ingress/message", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    const payload = request.body as
      | {
          sessionId?: unknown;
          agentId?: unknown;
          displayName?: unknown;
          capabilities?: unknown;
          roomId?: unknown;
          body?: unknown;
        }
      | undefined;

    if (
      !token ||
      typeof payload?.agentId !== "string" ||
      typeof payload.roomId !== "string" ||
      !isSafeRoomId(payload.roomId) ||
      typeof payload.body !== "string" ||
      payload.body.length === 0 ||
      (payload.displayName !== undefined && typeof payload.displayName !== "string") ||
      (payload.capabilities !== undefined &&
        (!Array.isArray(payload.capabilities) ||
          payload.capabilities.some((item) => typeof item !== "string")))
    ) {
      return reply.code(400).send({
        error: "authorization, agentId, safe roomId, body, and optional displayName/capabilities are required"
      });
    }

    try {
      const event = await bridgeService.sendMessage({
        token,
        sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
        agentId: payload.agentId,
        displayName: payload.displayName as string | undefined,
        capabilities: (payload.capabilities as string[] | undefined) ?? [],
        roomId: payload.roomId,
        body: payload.body
      });

      return reply.code(201).send(event);
    } catch (error) {
      return sendBridgeError(reply, error);
    }
  });
};
