import { join } from "node:path";

import { readJsonSnapshot, writeJsonSnapshotAtomic } from "../storage/json-snapshot";

export type WorkMemoryMessage = {
  messageId: string;
  speakerParticipantId: string;
  body: string;
  timestamp: string;
};

export type WorkMemoryRecord = {
  roomId: string;
  recentMessages: WorkMemoryMessage[];
  activeParticipantIds: string[];
  todoItems: string[];
  blockerItems: string[];
  decisionItems: string[];
  lastSummaryDraftId: string | null;
  updatedAt: string;
};

type WorkMemorySnapshot = {
  rooms: Record<string, WorkMemoryRecord>;
};

export interface WorkMemoryStore {
  get(roomId: string): WorkMemoryRecord | undefined;
  set(roomId: string, memory: WorkMemoryRecord): void;
}

export function createEmptyWorkMemory(roomId: string, updatedAt = ""): WorkMemoryRecord {
  return {
    roomId,
    recentMessages: [],
    activeParticipantIds: [],
    todoItems: [],
    blockerItems: [],
    decisionItems: [],
    lastSummaryDraftId: null,
    updatedAt
  };
}

function getWorkMemoryPath(dataDir?: string): string {
  return join(dataDir ?? process.cwd(), "data", "db", "work-memory.json");
}

function readSnapshot(filePath: string): WorkMemorySnapshot {
  const snapshot = readJsonSnapshot<WorkMemorySnapshot>(filePath, { rooms: {} });
  return typeof snapshot.rooms === "object" && snapshot.rooms !== null ? snapshot : { rooms: {} };
}

export function createWorkMemoryStore(dataDir?: string): WorkMemoryStore {
  const filePath = getWorkMemoryPath(dataDir);

  return {
    get(roomId) {
      const snapshot = readSnapshot(filePath);
      return snapshot.rooms[roomId];
    },
    set(roomId, memory) {
      const snapshot = readSnapshot(filePath);
      snapshot.rooms[roomId] = memory;
      writeJsonSnapshotAtomic(filePath, snapshot);
    }
  };
}
