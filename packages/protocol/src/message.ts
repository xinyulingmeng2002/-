import { attachmentSchema } from "./attachment";
import { z } from "zod";

export const messageMentionSchema = z.object({
  participantId: z.string().min(1),
  displayName: z.string().min(1)
}).strict();

export const messageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  kind: z.enum(["chat", "system", "status"]),
  speakerParticipantId: z.string(),
  body: z.string(),
  attachments: z.array(attachmentSchema).optional(),
  mentions: z.array(messageMentionSchema).optional(),
  replyToMessageId: z.string().min(1).optional()
}).strict();

export type MessageMention = z.infer<typeof messageMentionSchema>;
export type Message = z.infer<typeof messageSchema>;
