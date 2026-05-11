import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type OpenClawBridgeSessionRecord = {
  baseUrl: string;
  token: string;
  sessionId: string;
  agentId: string;
  displayName: string;
  roomId: string;
  capabilities: string[];
  heartbeatMs: number;
  lastEventId?: string;
};

function asMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function writeOpenClawBridgeSessionFile(
  filePath: string,
  session: OpenClawBridgeSessionRecord
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(session, null, 2), "utf8");
}

export function readOpenClawBridgeSessionFile(filePath: string): OpenClawBridgeSessionRecord {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as OpenClawBridgeSessionRecord;
  } catch (error) {
    throw new Error(`openclaw_bridge_session_read_failed:${asMessage(error)}`);
  }
}

export function removeOpenClawBridgeSessionFile(filePath: string): void {
  rmSync(filePath, { force: true });
}
