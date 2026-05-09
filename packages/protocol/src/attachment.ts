import { z } from "zod";

export const attachmentSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  kind: z.enum(["image", "file", "link"]),
  url: z.string().url(),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative()
}).strict();

export type Attachment = z.infer<typeof attachmentSchema>;
