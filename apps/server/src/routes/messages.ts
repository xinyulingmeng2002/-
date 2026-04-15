import type { FastifyPluginAsync } from "fastify";

import type { MessageService } from "../domain/messages/message-service";

type MessagesRoutesOptions = {
  messageService: MessageService;
};

export const messagesRoutes: FastifyPluginAsync<MessagesRoutesOptions> = async (app, options) => {
  const { messageService } = options;

  app.post("/api/messages", async (request, reply) => {
    const payload =
      request.body as { roomId?: string; speakerParticipantId?: string; body?: string } | undefined;

    if (!payload?.roomId || !payload?.speakerParticipantId || !payload?.body) {
      return reply.code(400).send({ error: "roomId, speakerParticipantId, and body are required" });
    }

    const event = await messageService.appendChatMessage({
      roomId: payload.roomId,
      speakerParticipantId: payload.speakerParticipantId,
      body: payload.body
    });

    return reply.code(201).send(event);
  });

  app.get("/api/messages", async (request, reply) => {
    const { roomId } = request.query as { roomId?: string };
    if (!roomId) {
      return reply.code(400).send({ error: "roomId is required" });
    }

    return { items: messageService.listRoomEvents(roomId) };
  });
};
