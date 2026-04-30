import type { FastifyPluginAsync } from "fastify";

import type {
  MemoryCandidateScope,
  MemoryCandidateStatus,
  MemoryCandidateStore
} from "../domain/memory/memory-candidate-store";
import type { MemoryReviewService } from "../domain/memory/memory-review-service";

type MemoryCandidatesRoutesOptions = {
  memoryCandidateStore: MemoryCandidateStore;
  memoryReviewService: MemoryReviewService;
};

function isScope(value: unknown): value is MemoryCandidateScope {
  return value === "shared" || value === "private";
}

function isStatus(value: unknown): value is MemoryCandidateStatus {
  return value === "proposed" || value === "accepted" || value === "rejected" || value === "expired";
}

export const memoryCandidatesRoutes: FastifyPluginAsync<MemoryCandidatesRoutesOptions> = async (
  app,
  options
) => {
  const { memoryCandidateStore, memoryReviewService } = options;

  app.get("/api/memory-candidates", async (request, reply) => {
    const query = request.query as { roomId?: unknown; scope?: unknown; status?: unknown };

    if (query.scope !== undefined && !isScope(query.scope)) {
      return reply.code(400).send({ error: "scope must be shared or private" });
    }
    if (query.status !== undefined && !isStatus(query.status)) {
      return reply.code(400).send({ error: "status must be proposed, accepted, rejected, or expired" });
    }
    if (query.roomId !== undefined && typeof query.roomId !== "string") {
      return reply.code(400).send({ error: "roomId must be a string" });
    }

    return {
      items: memoryCandidateStore.list({
        roomId: query.roomId as string | undefined,
        scope: query.scope as MemoryCandidateScope | undefined,
        status: query.status as MemoryCandidateStatus | undefined
      })
    };
  });

  app.post("/api/memory-candidates/:id/accept", async (request, reply) => {
    const { id } = request.params as { id?: string };
    const payload = request.body as { reviewedBy?: unknown } | undefined;

    if (!id || typeof payload?.reviewedBy !== "string" || payload.reviewedBy.length === 0) {
      return reply.code(400).send({ error: "reviewedBy is required" });
    }

    const accepted = memoryReviewService.acceptCandidate({
      candidateId: id,
      reviewedBy: payload.reviewedBy
    });
    if (!accepted) {
      return reply.code(404).send({ error: "memory candidate not found" });
    }

    return accepted;
  });

  app.post("/api/memory-candidates/:id/reject", async (request, reply) => {
    const { id } = request.params as { id?: string };
    const payload = request.body as { reviewedBy?: unknown } | undefined;

    if (!id || typeof payload?.reviewedBy !== "string" || payload.reviewedBy.length === 0) {
      return reply.code(400).send({ error: "reviewedBy is required" });
    }

    const rejected = memoryReviewService.rejectCandidate({
      candidateId: id,
      reviewedBy: payload.reviewedBy
    });
    if (!rejected) {
      return reply.code(404).send({ error: "memory candidate not found" });
    }

    return rejected;
  });
};
