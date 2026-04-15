import type { FastifyPluginAsync } from "fastify";

import { isSafeRoomId } from "../domain/messages/event-log-store";
import type { MessageService } from "../domain/messages/message-service";

type MessagesRoutesOptions = {
  messageService: MessageService;
};

const MAX_SPEAKER_PARTICIPANT_ID_LENGTH = 128;
const MAX_BODY_LENGTH = 4000;

export const messagesRoutes: FastifyPluginAsync<MessagesRoutesOptions> = async (app, options) => {
  const { messageService } = options;

  app.post("/api/messages", async (request, reply) => {
    const payload = request.body as Record<string, unknown> | undefined;
    const roomId = payload?.roomId;
    const speakerParticipantId = payload?.speakerParticipantId;
    const body = payload?.body;

    if (
      typeof roomId !== "string" ||
      roomId.length === 0 ||
      typeof speakerParticipantId !== "string" ||
      speakerParticipantId.length === 0 ||
      typeof body !== "string" ||
      body.length === 0
    ) {
      return reply.code(400).send({ error: "roomId, speakerParticipantId, and body are required" });
    }
    if (speakerParticipantId.length > MAX_SPEAKER_PARTICIPANT_ID_LENGTH) {
      return reply
        .code(400)
        .send({ error: `speakerParticipantId must be <= ${MAX_SPEAKER_PARTICIPANT_ID_LENGTH}` });
    }
    if (body.length > MAX_BODY_LENGTH) {
      return reply.code(400).send({ error: `body must be <= ${MAX_BODY_LENGTH}` });
    }
    if (!isSafeRoomId(roomId)) {
      return reply.code(400).send({ error: "roomId must match ^[a-zA-Z0-9_-]{1,64}$" });
    }

    try {
      const event = await messageService.appendChatMessage({
        roomId,
        speakerParticipantId,
        body
      });

      return reply.code(201).send(event);
    } catch (error) {
      app.log.error({ error }, "message persistence failed");
      return reply.code(500).send({ error: "message persistence failed" });
    }
  });

  app.get("/api/messages", async (request, reply) => {
    const roomId = (request.query as { roomId?: unknown }).roomId;
    if (typeof roomId !== "string" || roomId.length === 0) {
      return reply.code(400).send({ error: "roomId is required" });
    }
    if (!isSafeRoomId(roomId)) {
      return reply.code(400).send({ error: "roomId must match ^[a-zA-Z0-9_-]{1,64}$" });
    }

    try {
      return { items: messageService.listRoomEvents(roomId) };
    } catch (error) {
      app.log.error({ error }, "message log read failed");
      return reply.code(500).send({ error: "message log read failed" });
    }
  });
};
