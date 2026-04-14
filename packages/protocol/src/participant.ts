import { z } from "zod";

export const participantSchema = z.object({
  id: z.string(),
  type: z.enum(["human", "agent", "bridge", "system"]),
  displayName: z.string().min(1)
});

export type Participant = z.infer<typeof participantSchema>;
