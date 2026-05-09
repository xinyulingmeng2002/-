import { z } from "zod";

export const memorySchema = z.object({
  id: z.string(),
  roomId: z.string(),
  participantId: z.string(),
  content: z.string().min(1)
}).strict();

export const eventRecordSchema = z.object({
  eventId: z.string(),
  roomId: z.string(),
  spaceId: z.string(),
  kind: z.string().min(1),
  actorParticipantId: z.string(),
  timestamp: z.string(),
  payload: z.record(z.unknown()),
  source: z.enum(["human", "agent", "bridge", "system", "observer"]),
  causationId: z.string().nullable(),
  correlationId: z.string().nullable()
}).strict();

export const workMemoryMessageSchema = z.object({
  messageId: z.string(),
  speakerParticipantId: z.string(),
  body: z.string(),
  timestamp: z.string()
}).strict();

export const workMemoryRecordSchema = z.object({
  roomId: z.string(),
  recentMessages: z.array(workMemoryMessageSchema),
  activeParticipantIds: z.array(z.string()),
  todoItems: z.array(z.string()),
  blockerItems: z.array(z.string()),
  decisionItems: z.array(z.string()),
  lastSummaryDraftId: z.string().nullable(),
  updatedAt: z.string()
}).strict();

export const memoryCandidateSchema = z.object({
  candidateId: z.string(),
  roomId: z.string(),
  scope: z.enum(["shared", "private"]),
  candidateType: z.enum(["summary", "todo", "blocker", "decision"]),
  title: z.string().min(1),
  body: z.string().min(1),
  status: z.enum(["proposed", "accepted", "rejected", "expired"]),
  proposedBy: z.string().min(1),
  sourceEventIds: z.array(z.string()),
  sourceMemoryIds: z.array(z.string()),
  targetAgentId: z.string().nullable(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
  reviewedBy: z.string().nullable(),
  acceptedInto: z.array(z.enum(["l0", "l2"]))
}).strict();

export const sharedKnowledgeSchema = z.object({
  knowledgeId: z.string(),
  spaceId: z.string(),
  roomId: z.string(),
  kind: z.enum(["decision", "fact", "constraint", "todo"]),
  title: z.string().min(1),
  body: z.string().min(1),
  keywords: z.array(z.string()),
  sourceCandidateId: z.string(),
  sourceEventIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
}).strict();

export const privateMemorySchema = z.object({
  memoryId: z.string(),
  agentId: z.string(),
  roomId: z.string(),
  memoryType: z.enum(["note", "preference", "task-context", "insight"]),
  title: z.string().min(1),
  body: z.string().min(1),
  tags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  visibility: z.enum(["private"]),
  sourceEventIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastReferencedAt: z.string().nullable()
}).strict();

export type Memory = z.infer<typeof memorySchema>;
export type EventRecord = z.infer<typeof eventRecordSchema>;
export type WorkMemoryMessage = z.infer<typeof workMemoryMessageSchema>;
export type WorkMemoryRecord = z.infer<typeof workMemoryRecordSchema>;
export type MemoryCandidate = z.infer<typeof memoryCandidateSchema>;
export type SharedKnowledge = z.infer<typeof sharedKnowledgeSchema>;
export type PrivateMemory = z.infer<typeof privateMemorySchema>;
