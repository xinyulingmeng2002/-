import { attachmentSchema } from "./attachment";
import { z } from "zod";

export const messageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  kind: z.enum(["chat", "system", "status"]),
  speakerParticipantId: z.string(),
  body: z.string(),
  attachments: z.array(attachmentSchema).optional()
}).strict();

export type Message = z.infer<typeof messageSchema>;
