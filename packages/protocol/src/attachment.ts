import { z } from "zod";

export const attachmentSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  kind: z.enum(["image", "file", "link"]),
  url: z.string().url()
});

export type Attachment = z.infer<typeof attachmentSchema>;
