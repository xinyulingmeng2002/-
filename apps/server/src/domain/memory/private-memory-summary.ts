import type { PrivateMemoryRecord } from "./private-memory-store";

export type PrivateMemoryOverview = {
  agentId: string;
  roomId: string;
  totalMemories: number;
  shareableMemories: number;
  latestUpdatedAt: string | null;
  latestSourceEventIds: string[];
};

export function buildPrivateMemoryOverview(
  items: PrivateMemoryRecord[],
  filters: { roomId?: string } = {}
): PrivateMemoryOverview[] {
  const grouped = new Map<string, PrivateMemoryRecord[]>();

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

      return {
        agentId: group[0]?.agentId ?? "",
        roomId: group[0]?.roomId ?? "",
        totalMemories: group.length,
        shareableMemories: group.length,
        latestUpdatedAt: latest?.updatedAt ?? null,
        latestSourceEventIds: latest?.sourceEventIds ?? []
      };
    })
    .sort(
      (left, right) =>
        left.agentId.localeCompare(right.agentId) || left.roomId.localeCompare(right.roomId)
    );
}
