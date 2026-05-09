import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

function asMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function writeJsonSnapshotAtomic(filePath: string, data: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });

  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const payload = JSON.stringify(data, null, 2);

  writeFileSync(tempPath, payload, "utf8");

  try {
    renameSync(tempPath, filePath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw new Error(`Failed to commit snapshot at ${filePath}: ${asMessage(error)}`);
  }
}

export function readJsonSnapshot<T>(filePath: string, initialValue: T): T {
  mkdirSync(dirname(filePath), { recursive: true });

  let payload: string;

  try {
    payload = readFileSync(filePath, "utf8");
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;

    if (fsError.code === "ENOENT") {
      writeJsonSnapshotAtomic(filePath, initialValue);
      return initialValue;
    }

    throw new Error(`Failed to read snapshot at ${filePath}: ${asMessage(error)}`);
  }

  try {
    return JSON.parse(payload) as T;
  } catch (error) {
    throw new Error(`Failed to parse snapshot at ${filePath}: ${asMessage(error)}`);
  }
}
