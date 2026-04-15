import { join } from "node:path";

import { readJsonSnapshot, writeJsonSnapshotAtomic } from "../storage/json-snapshot";

export type ParticipantRecord = {
  id: string;
  type: "human" | "agent" | "bridge" | "system";
  displayName: string;
  bridgeKind: "codex" | "openclaw" | "generic" | null;
  capabilities: string[];
  createdAt: string;
  lastSeenAt: string;
};

type ParticipantsSnapshot = {
  items?: ParticipantRecord[];
};

export interface ParticipantStore {
  list(): ParticipantRecord[];
  get(id: string): ParticipantRecord | null;
  upsert(record: ParticipantRecord): ParticipantRecord;
}

function getParticipantsPath(dataDir?: string): string {
  return join(dataDir ?? process.cwd(), "data", "db", "participants.json");
}

function readParticipants(filePath: string): ParticipantRecord[] {
  const snapshot = readJsonSnapshot<ParticipantsSnapshot>(filePath, { items: [] });
  return Array.isArray(snapshot.items) ? snapshot.items : [];
}

function writeParticipants(filePath: string, items: ParticipantRecord[]): void {
  writeJsonSnapshotAtomic(filePath, { items });
}

export function createParticipantStore(dataDir?: string): ParticipantStore {
  const participantsPath = getParticipantsPath(dataDir);

  return {
    list() {
      return readParticipants(participantsPath);
    },
    get(id) {
      return readParticipants(participantsPath).find((item) => item.id === id) ?? null;
    },
    upsert(record) {
      const items = readParticipants(participantsPath);
      const index = items.findIndex((item) => item.id === record.id);

      if (index >= 0) {
        items[index] = record;
      } else {
        items.push(record);
      }

      writeParticipants(participantsPath, items);
      return record;
    }
  };
}
