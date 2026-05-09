import { createHash, randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";

import { readJsonSnapshot, writeJsonSnapshotAtomic } from "../storage/json-snapshot";

export const BRIDGE_KINDS = ["codex", "openclaw", "generic"] as const;

export type BridgeKind = (typeof BRIDGE_KINDS)[number];

export type BridgeTokenRecord = {
  id: string;
  label: string;
  bridgeKind: BridgeKind;
  allowedRoomIds: string[];
  createdAt: string;
  revokedAt: string | null;
};

type StoredBridgeTokenRecord = BridgeTokenRecord & {
  secretHash: string;
};

type BridgeTokensSnapshot = {
  items?: StoredBridgeTokenRecord[];
};

export interface BridgeTokenStore {
  list(): BridgeTokenRecord[];
  create(input: { label: string; bridgeKind: BridgeKind; allowedRoomIds: string[] }): {
    token: string;
    metadata: BridgeTokenRecord;
  };
  revoke(id: string): BridgeTokenRecord | undefined;
  findBySecret(token: string): StoredBridgeTokenRecord | undefined;
}

export function isBridgeKind(value: unknown): value is BridgeKind {
  return typeof value === "string" && BRIDGE_KINDS.includes(value as BridgeKind);
}

function getBridgeTokensPath(dataDir?: string): string {
  return join(dataDir ?? process.cwd(), "data", "db", "bridge-tokens.json");
}

function readBridgeTokens(filePath: string): StoredBridgeTokenRecord[] {
  const snapshot = readJsonSnapshot<BridgeTokensSnapshot>(filePath, { items: [] });
  return Array.isArray(snapshot.items) ? snapshot.items : [];
}

function writeBridgeTokens(filePath: string, items: StoredBridgeTokenRecord[]): void {
  writeJsonSnapshotAtomic(filePath, { items });
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function asPublicRecord(record: StoredBridgeTokenRecord): BridgeTokenRecord {
  return {
    id: record.id,
    label: record.label,
    bridgeKind: record.bridgeKind,
    allowedRoomIds: record.allowedRoomIds,
    createdAt: record.createdAt,
    revokedAt: record.revokedAt
  };
}

export function createBridgeTokenStore(
  dataDir?: string,
  now: () => Date = () => new Date()
): BridgeTokenStore {
  const bridgeTokensPath = getBridgeTokensPath(dataDir);

  return {
    list() {
      return readBridgeTokens(bridgeTokensPath).map(asPublicRecord);
    },
    create(input) {
      const items = readBridgeTokens(bridgeTokensPath);
      const token = `brg_${randomBytes(24).toString("hex")}`;
      const metadata: BridgeTokenRecord = {
        id: `bridge-token-${randomUUID()}`,
        label: input.label,
        bridgeKind: input.bridgeKind,
        allowedRoomIds: [...input.allowedRoomIds],
        createdAt: now().toISOString(),
        revokedAt: null
      };

      items.push({
        ...metadata,
        secretHash: hashSecret(token)
      });
      writeBridgeTokens(bridgeTokensPath, items);

      return { token, metadata };
    },
    revoke(id) {
      const items = readBridgeTokens(bridgeTokensPath);
      const record = items.find((item) => item.id === id);

      if (!record) {
        return undefined;
      }

      if (!record.revokedAt) {
        record.revokedAt = now().toISOString();
        writeBridgeTokens(bridgeTokensPath, items);
      }

      return asPublicRecord(record);
    },
    findBySecret(token) {
      const secretHash = hashSecret(token);
      return readBridgeTokens(bridgeTokensPath).find((item) => item.secretHash === secretHash);
    }
  };
}
