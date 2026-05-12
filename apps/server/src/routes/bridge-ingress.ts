import type { FastifyPluginAsync } from "fastify";

import { isSafeRoomId } from "../domain/messages/event-log-store";
import { BridgeService } from "../domain/bridges/bridge-service";

type BridgeIngressRoutesOptions = {
  bridgeService: BridgeService;
};

type AttachmentPayload = {
  id: string;
  messageId: string;
  kind: "image" | "file" | "link";
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

type BridgeDiagnosticsPayload = {
  lastEventId?: string;
  reconnectCount?: number;
  consecutiveFailures?: number;
  lastError?: string | null;
};

function parseDiagnostics(value: unknown): BridgeDiagnosticsPayload | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const diagnostics: BridgeDiagnosticsPayload = {};

  if (input.lastEventId !== undefined) {
    if (typeof input.lastEventId !== "string") {
      return null;
    }
    diagnostics.lastEventId = input.lastEventId;
  }

  if (input.reconnectCount !== undefined) {
    if (
      typeof input.reconnectCount !== "number" ||
      !Number.isInteger(input.reconnectCount) ||
      input.reconnectCount < 0
    ) {
      return null;
    }
    diagnostics.reconnectCount = input.reconnectCount;
  }

  if (input.consecutiveFailures !== undefined) {
    if (
      typeof input.consecutiveFailures !== "number" ||
      !Number.isInteger(input.consecutiveFailures) ||
      input.consecutiveFailures < 0
    ) {
      return null;
    }
    diagnostics.consecutiveFailures = input.consecutiveFailures;
  }

  if (input.lastError !== undefined) {
    if (input.lastError !== null && typeof input.lastError !== "string") {
      return null;
    }
    diagnostics.lastError = input.lastError;
  }

  return diagnostics;
}

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
    const payload = request.body as
      | { sessionId?: unknown; agentId?: unknown; diagnostics?: unknown }
      | undefined;

    if (!token || typeof payload?.agentId !== "string") {
      return reply.code(400).send({ error: "authorization and agentId are required" });
    }

    const diagnostics = parseDiagnostics(payload.diagnostics);
    if (diagnostics === null) {
      return reply.code(400).send({ error: "diagnostics must be a valid bridge diagnostics object" });
    }

    try {
      const session = bridgeService.heartbeat({
        token,
        sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
        agentId: payload.agentId,
        diagnostics
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
          attachments?: unknown;
        }
      | undefined;

    if (
      !token ||
      typeof payload?.agentId !== "string" ||
      typeof payload.roomId !== "string" ||
      !isSafeRoomId(payload.roomId) ||
      typeof payload.body !== "string" ||
      (payload.displayName !== undefined && typeof payload.displayName !== "string") ||
      (payload.capabilities !== undefined &&
        (!Array.isArray(payload.capabilities) ||
          payload.capabilities.some((item) => typeof item !== "string")))
    ) {
      return reply.code(400).send({
        error: "authorization, agentId, safe roomId, body, and optional displayName/capabilities are required"
      });
    }

    let attachments: AttachmentPayload[] | undefined;
    if (payload.attachments !== undefined) {
      if (!Array.isArray(payload.attachments)) {
        return reply.code(400).send({ error: "attachments must be an array" });
      }

      const parsedAttachments = payload.attachments.map((attachment) => {
        if (
          typeof attachment !== "object" ||
          attachment === null ||
          typeof attachment.id !== "string" ||
          typeof attachment.messageId !== "string" ||
          (attachment.kind !== "image" && attachment.kind !== "file" && attachment.kind !== "link") ||
          typeof attachment.url !== "string" ||
          typeof attachment.name !== "string" ||
          typeof attachment.mimeType !== "string" ||
          typeof attachment.sizeBytes !== "number" ||
          !Number.isFinite(attachment.sizeBytes) ||
          attachment.sizeBytes < 0
        ) {
          return null;
        }

        return {
          id: attachment.id,
          messageId: attachment.messageId,
          kind: attachment.kind,
          url: attachment.url,
          name: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes
        } satisfies AttachmentPayload;
      });

      if (parsedAttachments.some((attachment) => attachment === null)) {
        return reply.code(400).send({ error: "attachments contain invalid items" });
      }

      attachments = parsedAttachments as AttachmentPayload[];
    }

    if (payload.body.trim().length === 0 && (!attachments || attachments.length === 0)) {
      return reply.code(400).send({ error: "body or attachments are required" });
    }

    try {
      const event = await bridgeService.sendMessage({
        token,
        sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
        agentId: payload.agentId,
        displayName: payload.displayName as string | undefined,
        capabilities: (payload.capabilities as string[] | undefined) ?? [],
        roomId: payload.roomId,
        body: payload.body,
        attachments
      });

      return reply.code(201).send(event);
    } catch (error) {
      return sendBridgeError(reply, error);
    }
  });
};
