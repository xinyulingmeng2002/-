import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { readJsonSnapshot, writeJsonSnapshotAtomic } from "../storage/json-snapshot";

export type RoomRecord = {
  id: string;
  spaceId: string;
  name: string;
  participantIds: string[];
};

export interface RoomStore {
  listBySpace(spaceId: string): RoomRecord[];
  create(input: { spaceId: string; name: string }): RoomRecord;
}

function getRoomsPath(dataDir?: string): string {
  return join(dataDir ?? process.cwd(), "data", "db", "rooms.json");
}

function readRooms(filePath: string): RoomRecord[] {
  const parsed = readJsonSnapshot<{ items?: RoomRecord[] }>(filePath, { items: [] });
  return Array.isArray(parsed.items) ? parsed.items : [];
}

function writeRooms(filePath: string, items: RoomRecord[]): void {
  writeJsonSnapshotAtomic(filePath, { items });
}

export function createRoomStore(dataDir?: string): RoomStore {
  const roomsPath = getRoomsPath(dataDir);

  return {
    listBySpace(spaceId) {
      const items = readRooms(roomsPath);
      return items.filter((item) => item.spaceId === spaceId);
    },
    create(input) {
      const items = readRooms(roomsPath);
      const record: RoomRecord = {
        id: `room-${randomUUID()}`,
        spaceId: input.spaceId,
        name: input.name,
        participantIds: []
      };

      items.push(record);
      writeRooms(roomsPath, items);
      return record;
    }
  };
}
