import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { readJsonSnapshot, writeJsonSnapshotAtomic } from "../storage/json-snapshot";

export type PrivateMemoryType = "note" | "preference" | "task-context" | "insight";

export type PrivateMemoryRecord = {
  memoryId: string;
  agentId: string;
  roomId: string;
  memoryType: PrivateMemoryType;
  title: string;
  body: string;
  tags: string[];
  confidence: number;
  visibility: "private";
  sourceEventIds: string[];
  createdAt: string;
  updatedAt: string;
  lastReferencedAt: string | null;
};

type PrivateMemorySnapshot = {
  items?: PrivateMemoryRecord[];
};

type CreatePrivateMemoryInput = {
  agentId: string;
  roomId: string;
  memoryType: PrivateMemoryType;
  title: string;
  body: string;
  tags: string[];
  confidence: number;
  sourceEventIds: string[];
};

export interface PrivateMemoryStore {
  list(filters: { agentId: string; roomId?: string }): PrivateMemoryRecord[];
  create(input: CreatePrivateMemoryInput): PrivateMemoryRecord;
  get(memoryId: string): PrivateMemoryRecord | null;
}

function getPrivateMemoriesPath(dataDir?: string): string {
  return join(dataDir ?? process.cwd(), "data", "db", "private-memories.json");
}

function readPrivateMemories(filePath: string): PrivateMemoryRecord[] {
  const snapshot = readJsonSnapshot<PrivateMemorySnapshot>(filePath, { items: [] });
  return Array.isArray(snapshot.items) ? snapshot.items : [];
}

function writePrivateMemories(filePath: string, items: PrivateMemoryRecord[]): void {
  writeJsonSnapshotAtomic(filePath, { items });
}

export function createPrivateMemoryStore(
  dataDir?: string,
  now: () => Date = () => new Date()
): PrivateMemoryStore {
  const filePath = getPrivateMemoriesPath(dataDir);

  return {
    list(filters) {
      return readPrivateMemories(filePath).filter((record) => {
        if (record.agentId !== filters.agentId) {
          return false;
        }
        if (filters.roomId && record.roomId !== filters.roomId) {
          return false;
        }

        return true;
      });
    },
    create(input) {
      const timestamp = now().toISOString();
      const record: PrivateMemoryRecord = {
        memoryId: `mem_${randomUUID()}`,
        agentId: input.agentId,
        roomId: input.roomId,
        memoryType: input.memoryType,
        title: input.title,
        body: input.body,
        tags: input.tags,
        confidence: input.confidence,
        visibility: "private",
        sourceEventIds: input.sourceEventIds,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastReferencedAt: null
      };

      const items = readPrivateMemories(filePath);
      items.push(record);
      writePrivateMemories(filePath, items);
      return record;
    },
    get(memoryId) {
      return readPrivateMemories(filePath).find((record) => record.memoryId === memoryId) ?? null;
    }
  };
}
