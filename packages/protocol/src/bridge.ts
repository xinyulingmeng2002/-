import { z } from "zod";

export const bridgeTokenSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  bridgeKind: z.enum(["codex", "openclaw", "generic"]),
  allowedRoomIds: z.array(z.string()),
  createdAt: z.string(),
  revokedAt: z.string().nullable()
}).strict();

export const bridgeSessionSchema = z.object({
  id: z.string(),
  tokenId: z.string(),
  agentId: z.string(),
  status: z.enum(["connected", "disconnected"]),
  activeRoomIds: z.array(z.string()),
  connectedAt: z.string(),
  lastSeenAt: z.string(),
  expiresAt: z.string()
}).strict();

export type BridgeToken = z.infer<typeof bridgeTokenSchema>;
export type BridgeSession = z.infer<typeof bridgeSessionSchema>;
