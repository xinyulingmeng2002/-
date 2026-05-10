import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchBridgeWorkspaceEvents,
  fetchBridgeWorkspaceSnapshot,
  sendBridgeWorkspaceMessage
} from "../features/agent-workspace/bridge-workspace-client";

describe("bridge workspace client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches a bridge workspace snapshot with bearer token authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        agent: { id: "agent-codex-main", displayName: "Codex", capabilities: ["chat", "code"] },
        session: {
          id: "session-1",
          activeRoomIds: ["room-1"],
          lastSeenAt: "2026-05-10T00:00:00.000Z",
          expiresAt: "2026-05-10T00:02:00.000Z"
        },
        room: { id: "room-1" },
        participants: [],
        latestSummary: null,
        workMemory: null,
        sharedKnowledge: [],
        recentEvents: [],
        nextCursor: null
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await fetchBridgeWorkspaceSnapshot({
      baseUrl: "http://127.0.0.1:3000",
      bridgeToken: "secret-token",
      agentId: "agent-codex-main",
      sessionId: "session-1",
      roomId: "room-1",
      eventLimit: 20
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/bridge/egress/workspace?agentId=agent-codex-main&sessionId=session-1&roomId=room-1&eventLimit=20",
      {
        headers: {
          Accept: "application/json",
          Authorization: "Bearer secret-token"
        }
      }
    );
    expect(snapshot.agent.id).toBe("agent-codex-main");
  });

  it("fetches bridge room events from the last cursor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        items: [{ eventId: "evt-2", kind: "message.created", roomId: "room-1" }],
        nextCursor: "evt-2"
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const batch = await fetchBridgeWorkspaceEvents({
      baseUrl: "",
      bridgeToken: "secret-token",
      agentId: "agent-codex-main",
      sessionId: "session-1",
      roomId: "room-1",
      afterEventId: "evt-1",
      limit: 25
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bridge/egress/events?agentId=agent-codex-main&sessionId=session-1&roomId=room-1&afterEventId=evt-1&limit=25",
      {
        headers: {
          Accept: "application/json",
          Authorization: "Bearer secret-token"
        }
      }
    );
    expect(batch.nextCursor).toBe("evt-2");
  });

  it("sends a bridge workspace message with bearer token authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        eventId: "evt-3",
        kind: "message.created",
        roomId: "room-1",
        timestamp: "2026-05-10T00:00:05.000Z",
        payload: {
          messageId: "msg-3",
          speakerParticipantId: "agent-codex-main",
          body: "开始接续。"
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const sent = await sendBridgeWorkspaceMessage({
      baseUrl: "http://127.0.0.1:3000",
      bridgeToken: "secret-token",
      agentId: "agent-codex-main",
      sessionId: "session-1",
      roomId: "room-1",
      body: "开始接续。"
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3000/api/bridge/ingress/message", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer secret-token",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        agentId: "agent-codex-main",
        sessionId: "session-1",
        roomId: "room-1",
        body: "开始接续。"
      })
    });
    expect(sent.payload.body).toBe("开始接续。");
  });
});
