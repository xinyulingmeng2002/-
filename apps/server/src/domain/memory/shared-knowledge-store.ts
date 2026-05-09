import { join } from "node:path";

import { readJsonSnapshot, writeJsonSnapshotAtomic } from "../storage/json-snapshot";

export type SharedKnowledgeKind = "decision" | "fact" | "constraint" | "todo";

export type SharedKnowledgeRecord = {
  knowledgeId: string;
  spaceId: string;
  roomId: string;
  kind: SharedKnowledgeKind;
  title: string;
  body: string;
  keywords: string[];
  sourceCandidateId: string;
  sourceEventIds: string[];
  createdAt: string;
  updatedAt: string;
};

type SharedKnowledgeSnapshot = {
  items?: SharedKnowledgeRecord[];
};

export interface SharedKnowledgeStore {
  list(filters?: { roomId?: string; spaceId?: string }): SharedKnowledgeRecord[];
  create(record: SharedKnowledgeRecord): SharedKnowledgeRecord;
}

function getSharedKnowledgePath(dataDir?: string): string {
  return join(dataDir ?? process.cwd(), "data", "db", "shared-knowledge.json");
}

function readSharedKnowledge(filePath: string): SharedKnowledgeRecord[] {
  const snapshot = readJsonSnapshot<SharedKnowledgeSnapshot>(filePath, { items: [] });
  return Array.isArray(snapshot.items) ? snapshot.items : [];
}

function writeSharedKnowledge(filePath: string, items: SharedKnowledgeRecord[]): void {
  writeJsonSnapshotAtomic(filePath, { items });
}

export function createSharedKnowledgeStore(dataDir?: string): SharedKnowledgeStore {
  const filePath = getSharedKnowledgePath(dataDir);

  return {
    list(filters = {}) {
      return readSharedKnowledge(filePath).filter((record) => {
        if (filters.roomId && record.roomId !== filters.roomId) {
          return false;
        }
        if (filters.spaceId && record.spaceId !== filters.spaceId) {
          return false;
        }

        return true;
      });
    },
    create(record) {
      const items = readSharedKnowledge(filePath);
      items.push(record);
      writeSharedKnowledge(filePath, items);
      return record;
    }
  };
}
