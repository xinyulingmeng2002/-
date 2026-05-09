import { join } from "node:path";

import { readJsonSnapshot, writeJsonSnapshotAtomic } from "../storage/json-snapshot";

export type RoomSummaryRecord = {
  roomId: string;
  generatedAt: string;
  messageCount: number;
  participantCount: number;
  summaryText: string;
  sourceEventRange: {
    firstMessageId: string;
    lastMessageId: string;
  };
};

type RoomSummarySnapshot = {
  items?: RoomSummaryRecord[];
};

export interface RoomSummaryStore {
  list(roomId: string): RoomSummaryRecord[];
  getLatest(roomId: string): RoomSummaryRecord | null;
  append(record: RoomSummaryRecord): RoomSummaryRecord;
}

function getRoomSummariesPath(dataDir?: string): string {
  return join(dataDir ?? process.cwd(), "data", "db", "room-summaries.json");
}

function readRoomSummaries(filePath: string): RoomSummaryRecord[] {
  const snapshot = readJsonSnapshot<RoomSummarySnapshot>(filePath, { items: [] });
  return Array.isArray(snapshot.items) ? snapshot.items : [];
}

function writeRoomSummaries(filePath: string, items: RoomSummaryRecord[]): void {
  writeJsonSnapshotAtomic(filePath, { items });
}

export function createRoomSummaryStore(dataDir?: string): RoomSummaryStore {
  const roomSummariesPath = getRoomSummariesPath(dataDir);

  return {
    list(roomId) {
      return readRoomSummaries(roomSummariesPath).filter((item) => item.roomId === roomId);
    },
    getLatest(roomId) {
      return this.list(roomId).at(-1) ?? null;
    },
    append(record) {
      const items = readRoomSummaries(roomSummariesPath);
      items.push(record);
      writeRoomSummaries(roomSummariesPath, items);
      return record;
    }
  };
}
