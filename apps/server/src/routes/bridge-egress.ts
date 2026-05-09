import type { FastifyPluginAsync } from "fastify";

import { BridgeService } from "../domain/bridges/bridge-service";
import { isSafeRoomId } from "../domain/messages/event-log-store";

type BridgeEgressRoutesOptions = {
  bridgeService: BridgeService;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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

  if (message === "bridge_room_not_joined") {
    return reply.code(409).send({ error: "bridge session has not joined this room" });
  }

  if (message === "bridge_session_not_found") {
    return reply.code(404).send({ error: "bridge session not found" });
  }

  return reply.code(500).send({ error: "bridge egress failed" });
}

export const bridgeEgressRoutes: FastifyPluginAsync<BridgeEgressRoutesOptions> = async (
  app,
  options
) => {
  const { bridgeService } = options;

  app.get("/api/bridge/egress/events", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    const query = request.query as
      | {
          agentId?: unknown;
          sessionId?: unknown;
          roomId?: unknown;
          afterEventId?: unknown;
          limit?: unknown;
        }
      | undefined;

    const limit =
      typeof query?.limit === "string" && query.limit.length > 0 ? Number.parseInt(query.limit, 10) : DEFAULT_LIMIT;

    if (
      !token ||
      typeof query?.agentId !== "string" ||
      typeof query.roomId !== "string" ||
      !isSafeRoomId(query.roomId) ||
      (query.sessionId !== undefined && typeof query.sessionId !== "string") ||
      (query.afterEventId !== undefined && typeof query.afterEventId !== "string") ||
      !Number.isFinite(limit) ||
      limit <= 0 ||
      limit > MAX_LIMIT
    ) {
      return reply.code(400).send({
        error: "authorization, agentId, safe roomId, and optional sessionId/afterEventId/limit are required"
      });
    }

    try {
      return bridgeService.pullRoomEvents({
        token,
        agentId: query.agentId,
        sessionId: query.sessionId as string | undefined,
        roomId: query.roomId,
        afterEventId: query.afterEventId as string | undefined,
        limit
      });
    } catch (error) {
      return sendBridgeError(reply, error);
    }
  });

  app.get("/api/bridge/egress/workspace", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    const query = request.query as
      | {
          agentId?: unknown;
          sessionId?: unknown;
          roomId?: unknown;
          eventLimit?: unknown;
        }
      | undefined;

    const eventLimit =
      typeof query?.eventLimit === "string" && query.eventLimit.length > 0
        ? Number.parseInt(query.eventLimit, 10)
        : DEFAULT_LIMIT;

    if (
      !token ||
      typeof query?.agentId !== "string" ||
      typeof query.roomId !== "string" ||
      !isSafeRoomId(query.roomId) ||
      (query.sessionId !== undefined && typeof query.sessionId !== "string") ||
      !Number.isFinite(eventLimit) ||
      eventLimit <= 0 ||
      eventLimit > MAX_LIMIT
    ) {
      return reply.code(400).send({
        error: "authorization, agentId, safe roomId, and optional sessionId/eventLimit are required"
      });
    }

    try {
      return bridgeService.getWorkspaceSnapshot({
        token,
        agentId: query.agentId,
        sessionId: query.sessionId as string | undefined,
        roomId: query.roomId,
        eventLimit
      });
    } catch (error) {
      return sendBridgeError(reply, error);
    }
  });
};
