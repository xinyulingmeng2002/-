import type {
  MemoryCandidateRecord,
  MemoryCandidateType
} from "./memory-candidate-store";
import type { PrivateMemoryRecord, PrivateMemoryType } from "./private-memory-store";

export type SuggestedShareCandidate = {
  memoryId: string;
  candidateType: MemoryCandidateType;
};

export type PendingShareCandidate = {
  candidateId: string;
  memoryId: string;
  candidateType: MemoryCandidateType;
  submittedAt: string;
};

export type LatestShareOutcome = {
  candidateId: string;
  memoryId: string;
  candidateType: MemoryCandidateType;
  status: "accepted" | "rejected";
  reviewedAt: string | null;
};

export type PrivateMemoryOverview = {
  agentId: string;
  roomId: string;
  totalMemories: number;
  shareableMemories: number;
  latestUpdatedAt: string | null;
  latestSourceEventIds: string[];
  suggestedShareCandidate: SuggestedShareCandidate | null;
  pendingShareCandidate: PendingShareCandidate | null;
  latestShareOutcome: LatestShareOutcome | null;
};

function mapPrivateMemoryTypeToCandidateType(memoryType: PrivateMemoryType): MemoryCandidateType {
  switch (memoryType) {
    case "task-context":
      return "todo";
    case "note":
      return "summary";
    case "preference":
      return "decision";
    case "insight":
      return "decision";
  }
}

export function buildPrivateMemoryOverview(
  items: PrivateMemoryRecord[],
  candidates: MemoryCandidateRecord[] = [],
  filters: { roomId?: string } = {}
): PrivateMemoryOverview[] {
  const grouped = new Map<string, PrivateMemoryRecord[]>();
  const pendingByMemoryId = new Map<string, PendingShareCandidate>();
  const latestOutcomeByMemoryId = new Map<string, LatestShareOutcome>();

  for (const candidate of candidates) {
    if (candidate.scope !== "shared") {
      continue;
    }

    if (candidate.status === "proposed") {
      for (const memoryId of candidate.sourceMemoryIds) {
        pendingByMemoryId.set(memoryId, {
          candidateId: candidate.candidateId,
          memoryId,
          candidateType: candidate.candidateType,
          submittedAt: candidate.createdAt
        });
      }
    }

    if (candidate.status === "accepted" || candidate.status === "rejected") {
      for (const memoryId of candidate.sourceMemoryIds) {
        const current = latestOutcomeByMemoryId.get(memoryId);

        if (
          !current ||
          candidate.createdAt.localeCompare(currentandidateTimestamp(current, candidates)) > 0
        ) {
          latestOutcomeByMemoryId.set(memoryId, {
            candidateId: candidate.candidateId,
            memoryId,
            candidateType: candidate.candidateType,
            status: candidate.status,
            reviewedAt: candidate.reviewedAt
          });
        }
      }
    }
  }

  for (const item of items) {
    if (filters.roomId && item.roomId !== filters.roomId) {
      continue;
    }

    const key = `${item.agentId}::${item.roomId}`;
    const current = grouped.get(key) ?? [];
    current.push(item);
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((group) => {
      const latest = [...group].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
      const shareableItems = group.filter((item) => !pendingByMemoryId.has(item.memoryId));
      const latestShareable =
        [...shareableItems].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
      const latestPending = latest ? pendingByMemoryId.get(latest.memoryId) ?? null : null;
      const latestShareOutcome = latest ? latestOutcomeByMemoryId.get(latest.memoryId) ?? null : null;

      return {
        agentId: group[0]?.agentId ?? "",
        roomId: group[0]?.roomId ?? "",
        totalMemories: group.length,
        shareableMemories: shareableItems.length,
        latestUpdatedAt: latest?.updatedAt ?? null,
        latestSourceEventIds: latest?.sourceEventIds ?? [],
        suggestedShareCandidate: latestShareable
          ? {
              memoryId: latestShareable.memoryId,
              candidateType: mapPrivateMemoryTypeToCandidateType(latestShareable.memoryType)
            }
          : null,
        pendingShareCandidate: latestPending,
        latestShareOutcome
      };
    })
    .sort(
      (left, right) =>
        left.agentId.localeCompare(right.agentId) || left.roomId.localeCompare(right.roomId)
    );
}

function currentandidateTimestamp(
  outcome: LatestShareOutcome,
  candidates: MemoryCandidateRecord[]
): string {
  return candidates.find((candidate) => candidate.candidateId === outcome.candidateId)?.createdAt ?? "";
}
