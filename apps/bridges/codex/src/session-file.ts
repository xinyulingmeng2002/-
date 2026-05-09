import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type CodexBridgeSessionRecord = {
  baseUrl: string;
  token: string;
  sessionId: string;
  agentId: string;
  displayName: string;
  roomId: string;
  capabilities: string[];
  heartbeatMs: number;
};

function asMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function writeCodexBridgeSessionFile(
  filePath: string,
  session: CodexBridgeSessionRecord
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(session, null, 2), "utf8");
}

export function readCodexBridgeSessionFile(filePath: string): CodexBridgeSessionRecord {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as CodexBridgeSessionRecord;
  } catch (error) {
    throw new Error(`codex_bridge_session_read_failed:${asMessage(error)}`);
  }
}

export function removeCodexBridgeSessionFile(filePath: string): void {
  rmSync(filePath, { force: true });
}
