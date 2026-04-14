import { z } from "zod";

export const roomSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  title: z.string().min(1)
}).strict();

export type Room = z.infer<typeof roomSchema>;
