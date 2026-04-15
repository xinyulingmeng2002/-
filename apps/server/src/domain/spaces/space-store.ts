import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { readJsonSnapshot, writeJsonSnapshotAtomic } from "../storage/json-snapshot";

export type SpaceRecord = {
  id: string;
  name: string;
};

export interface SpaceStore {
  list(): SpaceRecord[];
  create(input: { name: string }): SpaceRecord;
}

const DEFAULT_SPACE: SpaceRecord = {
  id: "space-default",
  name: "默认空间"
};

function getSpacesPath(dataDir?: string): string {
  return join(dataDir ?? process.cwd(), "data", "db", "spaces.json");
}

function readSpaces(filePath: string): SpaceRecord[] {
  const parsed = readJsonSnapshot<{ items?: SpaceRecord[] }>(filePath, {
    items: [DEFAULT_SPACE]
  });

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const hasDefaultSpace = items.some((item) => item.id === DEFAULT_SPACE.id);

  if (!hasDefaultSpace) {
    const nextItems = [DEFAULT_SPACE, ...items];
    writeSpaces(filePath, nextItems);
    return nextItems;
  }

  return items;
}

function writeSpaces(filePath: string, items: SpaceRecord[]): void {
  writeJsonSnapshotAtomic(filePath, { items });
}

export function createSpaceStore(dataDir?: string): SpaceStore {
  const spacesPath = getSpacesPath(dataDir);

  return {
    list() {
      return readSpaces(spacesPath);
    },
    create(input) {
      const items = readSpaces(spacesPath);
      const record: SpaceRecord = {
        id: `space-${randomUUID()}`,
        name: input.name
      };

      items.push(record);
      writeSpaces(spacesPath, items);
      return record;
    }
  };
}
