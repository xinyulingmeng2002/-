import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { readJsonSnapshot, writeJsonSnapshotAtomic } from "../storage/json-snapshot";

export type BridgeSessionDiagnostics = {
  lastEventId?: string;
  reconnectCount?: number;
  consecutiveFailures?: number;
  lastError?: string | null;
  lastReportedAt: string;
};

export type BridgeSessionRecord = {
  id: string;
  tokenId: string;
  agentId: string;
  status: "connected" | "disconnected";
  activeRoomIds: string[];
  connectedAt: string;
  lastSeenAt: string;
  expiresAt: string;
  diagnostics?: BridgeSessionDiagnostics;
};

type BridgeSessionsSnapshot = {
  items?: BridgeSessionRecord[];
};

export interface BridgeSessionStore {
  list(): BridgeSessionRecord[];
  get(id: string): BridgeSessionRecord | null;
  findByTokenAndAgent(tokenId: string, agentId: string): BridgeSessionRecord | null;
  connect(input: {
    tokenId: string;
    agentId: string;
    connectedAt: string;
    lastSeenAt: string;
    expiresAt: string;
  }): BridgeSessionRecord;
  heartbeat(input: {
    id: string;
    lastSeenAt: string;
    expiresAt: string;
    diagnostics?: BridgeSessionDiagnostics;
  }): BridgeSessionRecord | null;
  bindRoom(input: { id: string; roomId: string }): BridgeSessionRecord | null;
  disconnect(input: { id: string; disconnectedAt: string }): BridgeSessionRecord | null;
}

function getBridgeSessionsPath(dataDir?: string): string {
  return join(dataDir ?? process.cwd(), "data", "db", "bridge-sessions.json");
}

function readBridgeSessions(filePath: string): BridgeSessionRecord[] {
  const snapshot = readJsonSnapshot<BridgeSessionsSnapshot>(filePath, { items: [] });
  return Array.isArray(snapshot.items) ? snapshot.items : [];
}

function writeBridgeSessions(filePath: string, items: BridgeSessionRecord[]): void {
  writeJsonSnapshotAtomic(filePath, { items });
}

export function createBridgeSessionStore(dataDir?: string): BridgeSessionStore {
  const bridgeSessionsPath = getBridgeSessionsPath(dataDir);

  return {
    list() {
      return readBridgeSessions(bridgeSessionsPath);
    },
    get(id) {
      return readBridgeSessions(bridgeSessionsPath).find((item) => item.id === id) ?? null;
    },
    findByTokenAndAgent(tokenId, agentId) {
      return (
        readBridgeSessions(bridgeSessionsPath).find(
          (item) => item.tokenId === tokenId && item.agentId === agentId
        ) ?? null
      );
    },
    connect(input) {
      const items = readBridgeSessions(bridgeSessionsPath);
      const index = items.findIndex(
        (item) => item.tokenId === input.tokenId && item.agentId === input.agentId
      );

      const nextRecord: BridgeSessionRecord = {
        id: index >= 0 ? items[index].id : `bridge-session-${randomUUID()}`,
        tokenId: input.tokenId,
        agentId: input.agentId,
        status: "connected",
        activeRoomIds: index >= 0 ? items[index].activeRoomIds : [],
        connectedAt: index >= 0 ? items[index].connectedAt : input.connectedAt,
        lastSeenAt: input.lastSeenAt,
        expiresAt: input.expiresAt
      };

      if (index >= 0) {
        items[index] = nextRecord;
      } else {
        items.push(nextRecord);
      }

      writeBridgeSessions(bridgeSessionsPath, items);
      return nextRecord;
    },
    heartbeat(input) {
      const items = readBridgeSessions(bridgeSessionsPath);
      const index = items.findIndex((item) => item.id === input.id);

      if (index < 0) {
        return null;
      }

      items[index] = {
        ...items[index],
        status: "connected",
        lastSeenAt: input.lastSeenAt,
        expiresAt: input.expiresAt,
        diagnostics: input.diagnostics ?? items[index].diagnostics
      };
      writeBridgeSessions(bridgeSessionsPath, items);
      return items[index];
    },
    bindRoom(input) {
      const items = readBridgeSessions(bridgeSessionsPath);
      const index = items.findIndex((item) => item.id === input.id);

      if (index < 0) {
        return null;
      }

      if (!items[index].activeRoomIds.includes(input.roomId)) {
        items[index] = {
          ...items[index],
          activeRoomIds: [...items[index].activeRoomIds, input.roomId]
        };
        writeBridgeSessions(bridgeSessionsPath, items);
      }

      return items[index];
    },
    disconnect(input) {
      const items = readBridgeSessions(bridgeSessionsPath);
      const index = items.findIndex((item) => item.id === input.id);

      if (index < 0) {
        return null;
      }

      items[index] = {
        ...items[index],
        status: "disconnected",
        lastSeenAt: input.disconnectedAt,
        expiresAt: input.disconnectedAt
      };
      writeBridgeSessions(bridgeSessionsPath, items);
      return items[index];
    }
  };
}
