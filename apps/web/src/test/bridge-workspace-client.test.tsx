import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchBridgeWorkspaceEvents,
  fetchBridgeWorkspacePrivateMemoryOverview,
  fetchBridgeWorkspaceSnapshot,
  shareBridgeWorkspacePrivateMemory,
  uploadBridgeWorkspaceFile,
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

  it("uploads a workspace file through the canonical upload endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        attachment: {
          id: "att-1",
          messageId: "",
          kind: "file",
          url: "/uploads/2026/05/spec.md",
          name: "spec.md",
          mimeType: "text/markdown",
          sizeBytes: 128
        },
        originalName: "spec.md",
        mimeType: "text/markdown",
        sizeBytes: 128
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["# spec"], "spec.md", { type: "text/markdown" });
    const uploaded = await uploadBridgeWorkspaceFile({
      baseUrl: "http://127.0.0.1:3000",
      file
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3000/api/uploads", {
      method: "POST",
      body: expect.any(FormData)
    });
    expect(uploaded.attachment.name).toBe("spec.md");
  });

  it("fetches redacted private memory overview for the workspace room", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        items: [
          {
            agentId: "agent-codex-main",
            roomId: "room-1",
            totalMemories: 1,
            shareableMemories: 1,
            latestUpdatedAt: "2026-05-10T00:00:00.000Z",
            latestSourceEventIds: ["evt-private-1"],
            suggestedShareCandidate: {
              memoryId: "mem-private-1",
              candidateType: "decision"
            },
            pendingShareCandidate: null,
            latestShareOutcome: null
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const overview = await fetchBridgeWorkspacePrivateMemoryOverview({
      baseUrl: "http://127.0.0.1:3000",
      roomId: "room-1"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/private-memories/summary?roomId=room-1",
      {
        headers: {
          Accept: "application/json"
        }
      }
    );
    expect(overview[0].agentId).toBe("agent-codex-main");
  });

  it("submits a private memory as a shared candidate from the workspace", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidateId: "cand-private-1",
        roomId: "room-1",
        scope: "shared",
        candidateType: "decision",
        title: "Private note promoted",
        body: "Promoted through candidate review.",
        status: "proposed",
        proposedBy: "agent:agent-codex-main",
        sourceEventIds: ["evt-private-1"],
        sourceMemoryIds: ["mem-private-1"],
        targetAgentId: "agent-codex-main",
        createdAt: "2026-05-10T00:00:05.000Z",
        reviewedAt: null,
        reviewedBy: null,
        acceptedInto: []
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const candidate = await shareBridgeWorkspacePrivateMemory({
      baseUrl: "http://127.0.0.1:3000",
      memoryId: "mem-private-1",
      agentId: "agent-codex-main",
      candidateType: "decision"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/private-memories/mem-private-1/share-candidate",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          agentId: "agent-codex-main",
          candidateType: "decision"
        })
      }
    );
    expect(candidate.candidateId).toBe("cand-private-1");
  });
});
