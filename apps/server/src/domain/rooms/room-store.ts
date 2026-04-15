import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

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

function ensureRoomsFile(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });

  try {
    readFileSync(filePath, "utf8");
  } catch {
    writeFileSync(filePath, JSON.stringify({ items: [] }, null, 2), "utf8");
  }
}

function readRooms(filePath: string): RoomRecord[] {
  ensureRoomsFile(filePath);
  const payload = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(payload) as { items?: RoomRecord[] };
  return Array.isArray(parsed.items) ? parsed.items : [];
}

function writeRooms(filePath: string, items: RoomRecord[]): void {
  writeFileSync(filePath, JSON.stringify({ items }, null, 2), "utf8");
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
