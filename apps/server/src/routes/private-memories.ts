import type { FastifyPluginAsync } from "fastify";

import type { PrivateMemoryStore, PrivateMemoryType } from "../domain/memory/private-memory-store";
import type { MemoryCandidateType } from "../domain/memory/memory-candidate-store";
import type { MemoryReviewService } from "../domain/memory/memory-review-service";

type PrivateMemoriesRoutesOptions = {
  privateMemoryStore: PrivateMemoryStore;
  memoryReviewService: MemoryReviewService;
};

function isPrivateMemoryType(value: unknown): value is PrivateMemoryType {
  return value === "note" || value === "preference" || value === "task-context" || value === "insight";
}

function isCandidateType(value: unknown): value is MemoryCandidateType {
  return value === "summary" || value === "todo" || value === "blocker" || value === "decision";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export const privateMemoriesRoutes: FastifyPluginAsync<PrivateMemoriesRoutesOptions> = async (
  app,
  options
) => {
  const { privateMemoryStore, memoryReviewService } = options;

  app.get("/api/private-memories", async (request, reply) => {
    const query = request.query as { agentId?: unknown; roomId?: unknown };

    if (typeof query.agentId !== "string" || query.agentId.length === 0) {
      return reply.code(400).send({ error: "agentId is required" });
    }
    if (query.roomId !== undefined && typeof query.roomId !== "string") {
      return reply.code(400).send({ error: "roomId must be a string" });
    }

    return {
      items: privateMemoryStore.list({
        agentId: query.agentId,
        roomId: query.roomId as string | undefined
      })
    };
  });

  app.post("/api/private-memories", async (request, reply) => {
    const payload = request.body as
      | {
          agentId?: unknown;
          roomId?: unknown;
          memoryType?: unknown;
          title?: unknown;
          body?: unknown;
          tags?: unknown;
          confidence?: unknown;
          sourceEventIds?: unknown;
        }
      | undefined;

    if (
      typeof payload?.agentId !== "string" ||
      typeof payload.roomId !== "string" ||
      !isPrivateMemoryType(payload.memoryType) ||
      typeof payload.title !== "string" ||
      payload.title.length === 0 ||
      typeof payload.body !== "string" ||
      payload.body.length === 0 ||
      !isStringArray(payload.tags) ||
      typeof payload.confidence !== "number" ||
      !Number.isFinite(payload.confidence) ||
      payload.confidence < 0 ||
      payload.confidence > 1 ||
      !isStringArray(payload.sourceEventIds)
    ) {
      return reply.code(400).send({
        error: "agentId, roomId, memoryType, title, body, tags, confidence, and sourceEventIds are required"
      });
    }

    const created = privateMemoryStore.create({
      agentId: payload.agentId,
      roomId: payload.roomId,
      memoryType: payload.memoryType,
      title: payload.title,
      body: payload.body,
      tags: payload.tags,
      confidence: payload.confidence,
      sourceEventIds: payload.sourceEventIds
    });

    return reply.code(201).send(created);
  });

  app.post("/api/private-memories/:id/share-candidate", async (request, reply) => {
    const { id } = request.params as { id?: string };
    const payload = request.body as { agentId?: unknown; candidateType?: unknown } | undefined;

    if (
      !id ||
      typeof payload?.agentId !== "string" ||
      payload.agentId.length === 0 ||
      !isCandidateType(payload.candidateType)
    ) {
      return reply.code(400).send({ error: "agentId and candidateType are required" });
    }

    try {
      const shared = memoryReviewService.sharePrivateMemoryAsCandidate({
        memoryId: id,
        agentId: payload.agentId,
        candidateType: payload.candidateType
      });
      if (!shared) {
        return reply.code(404).send({ error: "private memory not found" });
      }

      return reply.code(201).send(shared);
    } catch (error) {
      if (error instanceof Error && error.message === "private_memory_forbidden") {
        return reply.code(403).send({ error: "private memory does not belong to agent" });
      }

      throw error;
    }
  });
};
