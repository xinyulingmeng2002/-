import type { FastifyPluginAsync } from "fastify";

import { isSafeRoomId } from "../domain/messages/event-log-store";
import type { MessageService } from "../domain/messages/message-service";

type MessagesRoutesOptions = {
  messageService: MessageService;
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

const MAX_SPEAKER_PARTICIPANT_ID_LENGTH = 128;
const MAX_MENTION_DISPLAY_NAME_LENGTH = 128;
const MAX_REPLY_TO_MESSAGE_ID_LENGTH = 128;
const MAX_BODY_LENGTH = 4000;

export const messagesRoutes: FastifyPluginAsync<MessagesRoutesOptions> = async (app, options) => {
  const { messageService } = options;

  app.post("/api/messages", async (request, reply) => {
    const payload = request.body as Record<string, unknown> | undefined;
    const roomId = payload?.roomId;
    const speakerParticipantId = payload?.speakerParticipantId;
    const body = payload?.body;
    const attachmentsValue = payload?.attachments;
    const mentionsValue = payload?.mentions;
    const replyToMessageIdValue = payload?.replyToMessageId;

    if (
      typeof roomId !== "string" ||
      roomId.length === 0 ||
      typeof speakerParticipantId !== "string" ||
      speakerParticipantId.length === 0 ||
      typeof body !== "string"
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

    let attachments: AttachmentPayload[] | undefined;
    if (attachmentsValue !== undefined) {
      if (!Array.isArray(attachmentsValue)) {
        return reply.code(400).send({ error: "attachments must be an array" });
      }

      const parsedAttachments = attachmentsValue.map((attachment) => {
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

    let mentions: Array<{ participantId: string; displayName: string }> | undefined;
    if (mentionsValue !== undefined) {
      if (!Array.isArray(mentionsValue)) {
        return reply.code(400).send({ error: "mentions must be an array" });
      }

      const parsedMentions = mentionsValue.map((mention) => {
        if (
          typeof mention !== "object" ||
          mention === null ||
          typeof mention.participantId !== "string" ||
          mention.participantId.length === 0 ||
          mention.participantId.length > MAX_SPEAKER_PARTICIPANT_ID_LENGTH ||
          typeof mention.displayName !== "string" ||
          mention.displayName.length === 0 ||
          mention.displayName.length > MAX_MENTION_DISPLAY_NAME_LENGTH
        ) {
          return null;
        }

        return {
          participantId: mention.participantId,
          displayName: mention.displayName
        };
      });

      if (parsedMentions.some((mention) => mention === null)) {
        return reply.code(400).send({ error: "mentions contain invalid items" });
      }

      mentions = parsedMentions as Array<{ participantId: string; displayName: string }>;
    }

    let replyToMessageId: string | undefined;
    if (replyToMessageIdValue !== undefined) {
      if (
        typeof replyToMessageIdValue !== "string" ||
        replyToMessageIdValue.length === 0 ||
        replyToMessageIdValue.length > MAX_REPLY_TO_MESSAGE_ID_LENGTH
      ) {
        return reply.code(400).send({ error: `replyToMessageId must be 1-${MAX_REPLY_TO_MESSAGE_ID_LENGTH} chars` });
      }

      replyToMessageId = replyToMessageIdValue;
    }

    if (body.trim().length === 0 && (!attachments || attachments.length === 0)) {
      return reply.code(400).send({ error: "body or attachments are required" });
    }

    try {
      const event = await messageService.appendChatMessage({
        roomId,
        speakerParticipantId,
        body,
        attachments,
        mentions,
        replyToMessageId
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
