import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

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

function ensureSpacesFile(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });

  try {
    readFileSync(filePath, "utf8");
  } catch {
    writeFileSync(filePath, JSON.stringify({ items: [DEFAULT_SPACE] }, null, 2), "utf8");
  }
}

function readSpaces(filePath: string): SpaceRecord[] {
  ensureSpacesFile(filePath);
  const payload = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(payload) as { items?: SpaceRecord[] };
  return Array.isArray(parsed.items) ? parsed.items : [];
}

function writeSpaces(filePath: string, items: SpaceRecord[]): void {
  writeFileSync(filePath, JSON.stringify({ items }, null, 2), "utf8");
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
