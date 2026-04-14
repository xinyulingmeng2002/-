import { z } from "zod";

export const memorySchema = z.object({
  id: z.string(),
  roomId: z.string(),
  participantId: z.string(),
  content: z.string().min(1)
}).strict();

export type Memory = z.infer<typeof memorySchema>;
