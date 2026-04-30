import { join } from "node:path";

import { readJsonSnapshot, writeJsonSnapshotAtomic } from "../storage/json-snapshot";

export type MemoryCandidateScope = "shared" | "private";
export type MemoryCandidateType = "summary" | "todo" | "blocker" | "decision";
export type MemoryCandidateStatus = "proposed" | "accepted" | "rejected" | "expired";

export type MemoryCandidateRecord = {
  candidateId: string;
  roomId: string;
  scope: MemoryCandidateScope;
  candidateType: MemoryCandidateType;
  title: string;
  body: string;
  status: MemoryCandidateStatus;
  proposedBy: string;
  sourceEventIds: string[];
  sourceMemoryIds: string[];
  targetAgentId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  acceptedInto: Array<"l0" | "l2">;
};

type MemoryCandidateSnapshot = {
  items?: MemoryCandidateRecord[];
};

export interface MemoryCandidateStore {
  list(filters?: {
    roomId?: string;
    scope?: MemoryCandidateScope;
    status?: MemoryCandidateStatus;
  }): MemoryCandidateRecord[];
  create(record: MemoryCandidateRecord): MemoryCandidateRecord;
  get(candidateId: string): MemoryCandidateRecord | null;
  save(record: MemoryCandidateRecord): MemoryCandidateRecord;
}

function getMemoryCandidatesPath(dataDir?: string): string {
  return join(dataDir ?? process.cwd(), "data", "db", "memory-candidates.json");
}

function readMemoryCandidates(filePath: string): MemoryCandidateRecord[] {
  const snapshot = readJsonSnapshot<MemoryCandidateSnapshot>(filePath, { items: [] });
  return Array.isArray(snapshot.items) ? snapshot.items : [];
}

function writeMemoryCandidates(filePath: string, items: MemoryCandidateRecord[]): void {
  writeJsonSnapshotAtomic(filePath, { items });
}

export function createMemoryCandidateStore(dataDir?: string): MemoryCandidateStore {
  const filePath = getMemoryCandidatesPath(dataDir);

  return {
    list(filters = {}) {
      return readMemoryCandidates(filePath).filter((candidate) => {
        if (filters.roomId && candidate.roomId !== filters.roomId) {
          return false;
        }
        if (filters.scope && candidate.scope !== filters.scope) {
          return false;
        }
        if (filters.status && candidate.status !== filters.status) {
          return false;
        }

        return true;
      });
    },
    create(record) {
      const items = readMemoryCandidates(filePath);
      items.push(record);
      writeMemoryCandidates(filePath, items);
      return record;
    },
    get(candidateId) {
      return readMemoryCandidates(filePath).find((candidate) => candidate.candidateId === candidateId) ?? null;
    },
    save(record) {
      const items = readMemoryCandidates(filePath);
      const index = items.findIndex((candidate) => candidate.candidateId === record.candidateId);

      if (index === -1) {
        items.push(record);
      } else {
        items[index] = record;
      }

      writeMemoryCandidates(filePath, items);
      return record;
    }
  };
}
