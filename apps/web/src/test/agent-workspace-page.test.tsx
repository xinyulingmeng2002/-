import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchBridgeWorkspaceEvents,
  fetchBridgeWorkspaceSnapshot,
  fetchBridgeWorkspacePrivateMemoryOverview,
  shareBridgeWorkspacePrivateMemory,
  sendBridgeWorkspaceMessage,
  uploadBridgeWorkspaceFile
} from "../features/agent-workspace/bridge-workspace-client";

vi.mock("../features/agent-workspace/bridge-workspace-client", () => {
  return {
    fetchBridgeWorkspaceSnapshot: vi.fn(),
    fetchBridgeWorkspaceEvents: vi.fn(),
    fetchBridgeWorkspacePrivateMemoryOverview: vi.fn(),
    shareBridgeWorkspacePrivateMemory: vi.fn(),
    sendBridgeWorkspaceMessage: vi.fn(),
    uploadBridgeWorkspaceFile: vi.fn()
  };
});

import { App } from "../App";

describe("AgentWorkspacePage", () => {
  beforeEach(() => {
    vi.mocked(fetchBridgeWorkspaceSnapshot).mockReset();
    vi.mocked(fetchBridgeWorkspaceEvents).mockReset();
    vi.mocked(sendBridgeWorkspaceMessage).mockReset();
    vi.mocked(uploadBridgeWorkspaceFile).mockReset();
    vi.mocked(fetchBridgeWorkspacePrivateMemoryOverview).mockReset();
    vi.mocked(shareBridgeWorkspacePrivateMemory).mockReset();
    window.history.pushState(
      {},
      "",
      "/?view=agent-workspace&roomId=room-1&agentId=agent-codex-main&sessionId=session-1"
    );
    vi.mocked(fetchBridgeWorkspacePrivateMemoryOverview).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, "", "/");
  });

  it("loads a bridge workspace snapshot and watches room events", async () => {
    const intervalCallbacks: Array<() => void> = [];
    vi.spyOn(window, "setInterval").mockImplementation(((handler: () => void) => {
      intervalCallbacks.push(handler);
      return 1 as unknown as number;
    }) as typeof window.setInterval);
    vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);

    vi.mocked(fetchBridgeWorkspaceSnapshot).mockResolvedValueOnce({
      agent: {
        id: "agent-codex-main",
        displayName: "Codex",
        capabilities: ["chat", "code"]
      },
      session: {
        id: "session-1",
        activeRoomIds: ["room-1"],
        lastSeenAt: "2026-05-10T00:00:00.000Z",
        expiresAt: "2026-05-10T00:02:00.000Z"
      },
      room: { id: "room-1" },
      participants: [
        {
          id: "human-1",
          type: "human",
          displayName: "房主",
          bridgeKind: null,
          capabilities: ["chat"],
          lastSeenAt: "2026-05-10T00:00:00.000Z"
        },
        {
          id: "agent-codex-main",
          type: "agent",
          displayName: "Codex",
          bridgeKind: "codex",
          capabilities: ["chat", "code"],
          lastSeenAt: "2026-05-10T00:00:00.000Z"
        },
        {
          id: "agent-openclaw-main",
          type: "agent",
          displayName: "OpenClaw",
          bridgeKind: "openclaw",
          capabilities: ["chat", "research"],
          lastSeenAt: "2026-05-10T00:00:01.000Z"
        }
      ],
      latestSummary: {
        roomId: "room-1",
        generatedAt: "2026-05-10T00:00:00.000Z",
        messageCount: 2,
        participantCount: 2,
        summaryText: "房间已准备好供 Agent 接续工作。",
        sourceEventRange: {
          firstMessageId: "msg-1",
          lastMessageId: "msg-2"
        }
      },
      workMemory: {
        roomId: "room-1",
        recentMessages: [],
        activeParticipantIds: ["human-1", "agent-codex-main"],
        todoItems: ["先建立统一工作台"],
        blockerItems: ["等待 bridge token 输入"],
        decisionItems: ["使用独立 Agent 页面"],
        lastSummaryDraftId: null,
        updatedAt: "2026-05-10T00:00:00.000Z"
      },
      sharedKnowledge: [
        {
          knowledgeId: "know-1",
          spaceId: "space-default",
          roomId: "room-1",
          kind: "decision",
          title: "统一工作台",
          body: "Agent 通过独立工作入口查看 snapshot 和事件流。",
          keywords: ["agent", "workspace"],
          sourceCandidateId: "cand-1",
          sourceEventIds: ["evt-1"],
          createdAt: "2026-05-10T00:00:00.000Z",
          updatedAt: "2026-05-10T00:00:00.000Z"
        }
      ],
      memoryCandidates: [
        {
          candidateId: "cand-pending-1",
          roomId: "room-1",
          scope: "shared",
          candidateType: "decision",
          title: "待审核协作决策",
          body: "Agent 提交的共享候选需要等待人类审核。",
          status: "proposed",
          proposedBy: "agent:agent-codex-main",
          sourceEventIds: ["evt-2"],
          sourceMemoryIds: ["mem-1"],
          targetAgentId: "agent-codex-main",
          createdAt: "2026-05-10T00:00:00.000Z",
          reviewedAt: null,
          reviewedBy: null,
          acceptedInto: []
        }
      ],
      recentEvents: [
        {
          eventId: "evt-2",
          kind: "message.created",
          roomId: "room-1",
          timestamp: "2026-05-10T00:00:00.000Z",
          payload: {
            messageId: "msg-2",
            speakerParticipantId: "human-1",
            body: "@Codex 这条消息需要你回应。"
          }
        },
        {
          eventId: "evt-reply-1",
          kind: "message.created",
          roomId: "room-1",
          timestamp: "2026-05-10T00:00:01.000Z",
          payload: {
            messageId: "msg-reply-1",
            speakerParticipantId: "human-1",
            body: "> 回复 agent-codex-main: 我刚才的观点\n\n我接着这个点补一句。"
          }
        }
      ],
      nextCursor: "evt-reply-1"
    });
    vi.mocked(fetchBridgeWorkspaceSnapshot).mockResolvedValueOnce({
      agent: {
        id: "agent-codex-main",
        displayName: "Codex",
        capabilities: ["chat", "code"]
      },
      session: {
        id: "session-1",
        activeRoomIds: ["room-1"],
        lastSeenAt: "2026-05-10T00:00:10.000Z",
        expiresAt: "2026-05-10T00:02:10.000Z"
      },
      room: { id: "room-1" },
      participants: [],
      latestSummary: null,
      workMemory: {
        roomId: "room-1",
        recentMessages: [],
        activeParticipantIds: ["human-1", "agent-codex-main"],
        todoItems: [],
        blockerItems: [],
        decisionItems: ["待审核协作决策"],
        lastSummaryDraftId: null,
        updatedAt: "2026-05-10T00:00:10.000Z"
      },
      sharedKnowledge: [
        {
          knowledgeId: "know-accepted-1",
          spaceId: "space-default",
          roomId: "room-1",
          kind: "decision",
          title: "审核后共享决策",
          body: "人类已经接受该候选，Agent 工作台应看到共享层变化。",
          keywords: ["review"],
          sourceCandidateId: "cand-pending-1",
          sourceEventIds: ["evt-4"],
          createdAt: "2026-05-10T00:00:10.000Z",
          updatedAt: "2026-05-10T00:00:10.000Z"
        }
      ],
      memoryCandidates: [],
      recentEvents: [],
      nextCursor: "evt-4"
    });

    vi.mocked(fetchBridgeWorkspaceEvents).mockResolvedValueOnce({
      items: [
        {
          eventId: "evt-4",
          kind: "memory.candidate.accepted",
          roomId: "room-1",
          timestamp: "2026-05-10T00:00:10.000Z",
          payload: {
            messageId: "cand-pending-1",
            speakerParticipantId: "human-1",
            body: "候选已被人类接受。"
          }
        }
      ],
      nextCursor: "evt-4"
    });

    render(<App />);

    expect(screen.getByText("Agent 工作台")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Bridge Token"), {
      target: {
        value: "secret-token"
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "连接工作台" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getAllByText("Codex").length).toBeGreaterThan(0);
    expect(screen.getByText("房间成员")).toBeInTheDocument();
    expect(screen.getByText("房主")).toBeInTheDocument();
    expect(screen.getByText("human-1 · human · chat")).toBeInTheDocument();
    expect(screen.getByText("agent-codex-main · agent · codex · chat, code")).toBeInTheDocument();
    expect(screen.getByText("OpenClaw")).toBeInTheDocument();
    expect(screen.getByText("agent-openclaw-main · agent · openclaw · chat, research")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "对 房主 说" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "对 OpenClaw 说" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "对 OpenClaw 说" }));
    expect(screen.getByLabelText("消息内容")).toHaveValue("@OpenClaw ");
    expect(screen.getByText("提到我的消息")).toBeInTheDocument();
    expect(screen.getAllByText("@Codex 这条消息需要你回应。").length).toBeGreaterThan(0);
    expect(screen.getByText("回复我的消息")).toBeInTheDocument();
    expect(screen.getAllByText(/回复 agent-codex-main: 我刚才的观点/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/我接着这个点补一句。/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "引用回复 evt-2" }));
    expect(screen.getByLabelText("消息内容")).toHaveValue(
      "> 回复 human-1: @Codex 这条消息需要你回应。\n\n"
    );
    expect(screen.getByText("统一工作台")).toBeInTheDocument();
    expect(screen.getByText("待审核候选")).toBeInTheDocument();
    expect(screen.getByText("待审核协作决策")).toBeInTheDocument();
    expect(screen.getByText("Agent 提交的共享候选需要等待人类审核。")).toBeInTheDocument();
    expect(screen.getByText("先建立统一工作台")).toBeInTheDocument();
    expect(screen.getByText("等待 bridge token 输入")).toBeInTheDocument();

    await act(async () => {
      await intervalCallbacks[0]?.();
    });
    expect(fetchBridgeWorkspaceEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        bridgeToken: "secret-token",
        agentId: "agent-codex-main",
        sessionId: "session-1",
        roomId: "room-1",
        afterEventId: "evt-reply-1"
      })
    );

    expect(fetchBridgeWorkspaceSnapshot).toHaveBeenCalledTimes(2);
    expect(screen.getByText("候选已被人类接受。")).toBeInTheDocument();
    expect(await screen.findByText("审核后共享决策")).toBeInTheDocument();
    expect(screen.getByText("人类已经接受该候选，Agent 工作台应看到共享层变化。")).toBeInTheDocument();
  });

  it("sends a bridge workspace message from the composer and refreshes the workspace snapshot", async () => {
    vi.mocked(fetchBridgeWorkspaceSnapshot).mockResolvedValueOnce({
      agent: {
        id: "agent-codex-main",
        displayName: "Codex",
        capabilities: ["chat", "code"]
      },
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
      memoryCandidates: [],
      recentEvents: [],
      nextCursor: null
    });
    vi.mocked(fetchBridgeWorkspaceSnapshot).mockResolvedValueOnce({
      agent: {
        id: "agent-codex-main",
        displayName: "Codex",
        capabilities: ["chat", "code"]
      },
      session: {
        id: "session-1",
        activeRoomIds: ["room-1"],
        lastSeenAt: "2026-05-10T00:00:05.000Z",
        expiresAt: "2026-05-10T00:02:05.000Z"
      },
      room: { id: "room-1" },
      participants: [],
      latestSummary: null,
      workMemory: {
        roomId: "room-1",
        recentMessages: [],
        activeParticipantIds: ["agent-codex-main"],
        todoItems: ["继续接续房间上下文"],
        blockerItems: [],
        decisionItems: [],
        lastSummaryDraftId: null,
        updatedAt: "2026-05-10T00:00:05.000Z"
      },
      sharedKnowledge: [],
      memoryCandidates: [],
      recentEvents: [],
      nextCursor: "evt-3"
    });
    vi.mocked(sendBridgeWorkspaceMessage).mockResolvedValue({
      eventId: "evt-3",
      kind: "message.created",
      roomId: "room-1",
      timestamp: "2026-05-10T00:00:05.000Z",
      payload: {
        messageId: "msg-3",
        speakerParticipantId: "agent-codex-main",
        body: "开始接续。"
      }
    });
    vi.mocked(fetchBridgeWorkspaceEvents).mockResolvedValueOnce({
      items: [],
      nextCursor: "evt-3"
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText("Bridge Token"), {
      target: {
        value: "secret-token"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "连接工作台" }));

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText("消息内容"), {
      target: {
        value: "开始接续。"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendBridgeWorkspaceMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        bridgeToken: "secret-token",
        agentId: "agent-codex-main",
        sessionId: "session-1",
        roomId: "room-1",
        body: "开始接续。"
      })
    );
    expect(screen.getByText("开始接续。")).toBeInTheDocument();
    expect(fetchBridgeWorkspaceSnapshot).toHaveBeenCalledTimes(2);
    expect(fetchBridgeWorkspaceEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        afterEventId: undefined,
        limit: 20
      })
    );
    expect(await screen.findByText("继续接续房间上下文")).toBeInTheDocument();
  });

  it("uploads a file and sends it as a bridge workspace attachment", async () => {
    vi.mocked(fetchBridgeWorkspaceSnapshot).mockResolvedValueOnce({
      agent: {
        id: "agent-codex-main",
        displayName: "Codex",
        capabilities: ["chat", "code"]
      },
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
      memoryCandidates: [],
      recentEvents: [],
      nextCursor: null
    });
    vi.mocked(fetchBridgeWorkspaceSnapshot).mockResolvedValueOnce({
      agent: {
        id: "agent-codex-main",
        displayName: "Codex",
        capabilities: ["chat", "code"]
      },
      session: {
        id: "session-1",
        activeRoomIds: ["room-1"],
        lastSeenAt: "2026-05-10T00:00:05.000Z",
        expiresAt: "2026-05-10T00:02:05.000Z"
      },
      room: { id: "room-1" },
      participants: [],
      latestSummary: null,
      workMemory: {
        roomId: "room-1",
        recentMessages: [],
        activeParticipantIds: ["agent-codex-main"],
        todoItems: ["处理附件材料"],
        blockerItems: [],
        decisionItems: [],
        lastSummaryDraftId: null,
        updatedAt: "2026-05-10T00:00:05.000Z"
      },
      sharedKnowledge: [],
      memoryCandidates: [],
      recentEvents: [],
      nextCursor: "evt-attach-1"
    });
    vi.mocked(uploadBridgeWorkspaceFile).mockResolvedValue({
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
    });
    vi.mocked(sendBridgeWorkspaceMessage).mockResolvedValue({
      eventId: "evt-attach-1",
      kind: "message.created",
      roomId: "room-1",
      timestamp: "2026-05-10T00:00:05.000Z",
      payload: {
        messageId: "msg-attach-1",
        speakerParticipantId: "agent-codex-main",
        body: "补充材料",
        attachments: [
          {
            id: "att-1",
            messageId: "msg-attach-1",
            kind: "file",
            url: "/uploads/2026/05/spec.md",
            name: "spec.md",
            mimeType: "text/markdown",
            sizeBytes: 128
          }
        ]
      }
    });
    vi.mocked(fetchBridgeWorkspaceEvents).mockResolvedValueOnce({
      items: [],
      nextCursor: "evt-attach-1"
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText("Bridge Token"), {
      target: {
        value: "secret-token"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "连接工作台" }));

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText("消息内容"), {
      target: {
        value: "补充材料"
      }
    });

    const file = new File(["# spec"], "spec.md", { type: "text/markdown" });
    fireEvent.change(screen.getByLabelText("上传附件"), {
      target: {
        files: [file]
      }
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(uploadBridgeWorkspaceFile).toHaveBeenCalledWith({
      baseUrl: "",
      file
    });
    expect(sendBridgeWorkspaceMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        bridgeToken: "secret-token",
        agentId: "agent-codex-main",
        sessionId: "session-1",
        roomId: "room-1",
        body: "补充材料",
        attachments: [
          expect.objectContaining({
            id: "att-1",
            name: "spec.md"
          })
        ]
      })
    );
    expect(screen.getByText("spec.md")).toBeInTheDocument();
    expect(fetchBridgeWorkspaceSnapshot).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("处理附件材料")).toBeInTheDocument();
  });

  it("submits a private memory as a shared candidate from the workspace", async () => {
    vi.mocked(fetchBridgeWorkspaceSnapshot).mockResolvedValueOnce({
      agent: {
        id: "agent-codex-main",
        displayName: "Codex",
        capabilities: ["chat", "code"]
      },
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
      memoryCandidates: [],
      recentEvents: [],
      nextCursor: null
    });
    vi.mocked(fetchBridgeWorkspaceSnapshot).mockResolvedValueOnce({
      agent: {
        id: "agent-codex-main",
        displayName: "Codex",
        capabilities: ["chat", "code"]
      },
      session: {
        id: "session-1",
        activeRoomIds: ["room-1"],
        lastSeenAt: "2026-05-10T00:00:05.000Z",
        expiresAt: "2026-05-10T00:02:05.000Z"
      },
      room: { id: "room-1" },
      participants: [],
      latestSummary: null,
      workMemory: {
        roomId: "room-1",
        recentMessages: [],
        activeParticipantIds: ["agent-codex-main"],
        todoItems: [],
        blockerItems: [],
        decisionItems: ["候选已提交，等待人工审核"],
        lastSummaryDraftId: null,
        updatedAt: "2026-05-10T00:00:05.000Z"
      },
      sharedKnowledge: [],
      memoryCandidates: [],
      recentEvents: [],
      nextCursor: "evt-private-submitted"
    });
    vi.mocked(fetchBridgeWorkspacePrivateMemoryOverview)
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([
        {
          agentId: "agent-codex-main",
          roomId: "room-1",
          totalMemories: 1,
          shareableMemories: 0,
          latestUpdatedAt: "2026-05-10T00:00:00.000Z",
          latestSourceEventIds: ["evt-private-1"],
          suggestedShareCandidate: null,
          pendingShareCandidate: {
            candidateId: "cand-private-1",
            memoryId: "mem-private-1",
            candidateType: "decision",
            submittedAt: "2026-05-10T00:00:05.000Z"
          },
          latestShareOutcome: null
        }
      ]);
    vi.mocked(shareBridgeWorkspacePrivateMemory).mockResolvedValue({
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
    });
    vi.mocked(fetchBridgeWorkspaceEvents).mockResolvedValueOnce({
      items: [
        {
          eventId: "evt-private-submitted",
          kind: "memory.candidate.submitted",
          roomId: "room-1",
          timestamp: "2026-05-10T00:00:05.000Z",
          payload: {
            messageId: "cand-private-1",
            speakerParticipantId: "agent-codex-main",
            body: "共享候选已提交，等待人工审核。"
          }
        }
      ],
      nextCursor: "evt-private-submitted"
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText("Bridge Token"), {
      target: {
        value: "secret-token"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "连接工作台" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchBridgeWorkspacePrivateMemoryOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "",
        roomId: "room-1"
      })
    );
    expect(screen.getByText("私有记忆状态")).toBeInTheDocument();
    expect(screen.getAllByText("agent-codex-main")).toHaveLength(2);
    expect(screen.getByText("1 条私有记忆 / 1 条可提交候选")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "提交为共享候选" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(shareBridgeWorkspacePrivateMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "",
        memoryId: "mem-private-1",
        agentId: "agent-codex-main",
        candidateType: "decision"
      })
    );
    expect(screen.getByText("1 条私有记忆 / 0 条可提交候选")).toBeInTheDocument();
    expect(screen.getByText("已提交候选 cand-private-1")).toBeInTheDocument();
    expect(fetchBridgeWorkspaceSnapshot).toHaveBeenCalledTimes(2);
    expect(fetchBridgeWorkspaceEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        afterEventId: undefined,
        limit: 20
      })
    );
    expect(await screen.findByText("候选已提交，等待人工审核")).toBeInTheDocument();
    expect(screen.getByText("共享候选已提交，等待人工审核。")).toBeInTheDocument();
  });
});
