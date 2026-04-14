import { z } from "zod";

export const spaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1)
});

export type Space = z.infer<typeof spaceSchema>;
