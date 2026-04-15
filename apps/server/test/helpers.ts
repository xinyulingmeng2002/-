import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function createTempDir(prefix = "ma-server-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function cleanupTempDir(dirPath: string): void {
  rmSync(dirPath, { recursive: true, force: true });
}
