import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type RoomEventRecord = {
  eventId: string;
  kind: string;
  roomId: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

export interface EventLogStore {
  append(event: RoomEventRecord): void;
  list(roomId: string): RoomEventRecord[];
}

const SAFE_ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function isSafeRoomId(roomId: string): boolean {
  return SAFE_ROOM_ID_PATTERN.test(roomId);
}

function assertSafeRoomId(roomId: string): void {
  if (!isSafeRoomId(roomId)) {
    throw new Error(`Invalid roomId "${roomId}". roomId must match ^[a-zA-Z0-9_-]{1,64}$`);
  }
}

function getRoomLogPath(roomId: string, dataDir?: string): string {
  assertSafeRoomId(roomId);
  return join(dataDir ?? process.cwd(), "data", "logs", "rooms", `${roomId}.jsonl`);
}

function asMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function createEventLogStore(dataDir?: string): EventLogStore {
  return {
    append(event) {
      const filePath = getRoomLogPath(event.roomId, dataDir);
      mkdirSync(dirname(filePath), { recursive: true });

      try {
        appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
      } catch (error) {
        throw new Error(`Failed to append room event log at ${filePath}: ${asMessage(error)}`);
      }
    },
    list(roomId) {
      const filePath = getRoomLogPath(roomId, dataDir);
      let raw: string;

      try {
        raw = readFileSync(filePath, "utf8");
      } catch (error) {
        const fsError = error as NodeJS.ErrnoException;
        if (fsError.code === "ENOENT") {
          return [];
        }

        throw new Error(`Failed to read room event log at ${filePath}: ${asMessage(error)}`);
      }

      const lines = raw.split("\n");
      let lastNonEmptyIndex = -1;
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        if (lines[i]?.trim()) {
          lastNonEmptyIndex = i;
          break;
        }
      }

      const events: RoomEventRecord[] = [];
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i]?.trim() ?? "";
        if (!line) {
          continue;
        }

        try {
          events.push(JSON.parse(line) as RoomEventRecord);
        } catch (error) {
          if (i === lastNonEmptyIndex) {
            continue;
          }

          throw new Error(
            `Failed to parse room event log for roomId=${roomId} at ${filePath}:${i + 1}: ${asMessage(error)}`
          );
        }
      }

      return events;
    }
  };
}
