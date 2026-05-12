import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type GenericBridgeSessionRecord = {
  baseUrl: string;
  token: string;
  sessionId: string;
  agentId: string;
  displayName: string;
  roomId: string;
  capabilities: string[];
  heartbeatMs: number;
  lastEventId?: string;
  reconnectCount?: number;
  consecutiveFailures?: number;
  lastError?: string | null;
};

export function readGenericBridgeSessionFile(filePath: string): GenericBridgeSessionRecord {
  return JSON.parse(readFileSync(filePath, "utf8")) as GenericBridgeSessionRecord;
}

export function writeGenericBridgeSessionFile(
  filePath: string,
  session: GenericBridgeSessionRecord
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(session, null, 2), "utf8");
}

export function removeGenericBridgeSessionFile(filePath: string): void {
  rmSync(filePath, { force: true });
}
