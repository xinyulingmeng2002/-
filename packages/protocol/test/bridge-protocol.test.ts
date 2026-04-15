import { describe, expect, it } from "vitest";
import { bridgeSessionSchema, bridgeTokenSchema } from "../src";

describe("bridge protocol schemas", () => {
  it("accepts valid bridge token and session payloads", () => {
    expect(
      bridgeTokenSchema.parse({
        id: "t1",
        label: "Codex bridge",
        bridgeKind: "codex",
        allowedRoomIds: ["room-1", "room-2"],
        createdAt: "2026-04-15T00:00:00.000Z",
        revokedAt: null
      }),
    ).toEqual({
      id: "t1",
      label: "Codex bridge",
      bridgeKind: "codex",
      allowedRoomIds: ["room-1", "room-2"],
      createdAt: "2026-04-15T00:00:00.000Z",
      revokedAt: null
    });

    expect(
      bridgeSessionSchema.parse({
        id: "s1",
        tokenId: "t1",
        agentId: "agent-1",
        status: "connected",
        activeRoomIds: ["room-1"],
        connectedAt: "2026-04-15T00:00:00.000Z",
        lastSeenAt: "2026-04-15T00:01:00.000Z"
      }),
    ).toEqual({
      id: "s1",
      tokenId: "t1",
      agentId: "agent-1",
      status: "connected",
      activeRoomIds: ["room-1"],
      connectedAt: "2026-04-15T00:00:00.000Z",
      lastSeenAt: "2026-04-15T00:01:00.000Z"
    });
  });

  it("requires the base bridge token and session fields", () => {
    expect(() => bridgeTokenSchema.parse({ id: "t1" })).toThrow();
    expect(() => bridgeSessionSchema.parse({ id: "s1" })).toThrow();
  });

  it("rejects unsupported bridge kinds and statuses", () => {
    expect(() =>
      bridgeTokenSchema.parse({
        id: "t1",
        label: "Codex bridge",
        bridgeKind: "unknown",
        allowedRoomIds: ["room-1"],
        createdAt: "2026-04-15T00:00:00.000Z",
        revokedAt: null
      }),
    ).toThrow();

    expect(() =>
      bridgeSessionSchema.parse({
        id: "s1",
        tokenId: "t1",
        agentId: "agent-1",
        status: "stale",
        activeRoomIds: ["room-1"],
        connectedAt: "2026-04-15T00:00:00.000Z",
        lastSeenAt: "2026-04-15T00:00:00.000Z"
      }),
    ).toThrow();
  });

  it("rejects unknown keys in bridge protocol objects", () => {
    expect(() =>
      bridgeTokenSchema.parse({
        id: "t1",
        label: "Codex bridge",
        bridgeKind: "codex",
        allowedRoomIds: ["room-1"],
        createdAt: "2026-04-15T00:00:00.000Z",
        revokedAt: null,
        extra: true
      }),
    ).toThrow();

    expect(() =>
      bridgeSessionSchema.parse({
        id: "s1",
        tokenId: "t1",
        agentId: "agent-1",
        status: "connected",
        activeRoomIds: ["room-1"],
        connectedAt: "2026-04-15T00:00:00.000Z",
        lastSeenAt: "2026-04-15T00:00:00.000Z",
        extra: true
      }),
    ).toThrow();
  });
});
