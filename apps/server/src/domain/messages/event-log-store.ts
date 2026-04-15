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

function getRoomLogPath(roomId: string, dataDir?: string): string {
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

      try {
        const raw = readFileSync(filePath, "utf8");
        return raw
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line) as RoomEventRecord);
      } catch (error) {
        const fsError = error as NodeJS.ErrnoException;
        if (fsError.code === "ENOENT") {
          return [];
        }

        throw new Error(`Failed to read room event log at ${filePath}: ${asMessage(error)}`);
      }
    }
  };
}
