import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../api/client";
import type { RoomSocketClient } from "../api/socket";
import { RoomShell } from "../features/rooms/room-shell";

describe("RoomShell", () => {
  it("subscribes to realtime presence and incoming messages", async () => {
    const sharePrivateMemoryAsCandidate = vi.fn().mockResolvedValue({
      candidateId: "cand-private-1",
      roomId: "room-1",
      scope: "shared",
      candidateType: "decision",
      title: "Private note promoted",
      body: "Promoted through candidate review.",
      status: "proposed",
      proposedBy: "agent:agent-codex",
      sourceEventIds: ["evt-private-1"],
      sourceMemoryIds: ["mem-private-1"],
      targetAgentId: "agent-codex",
      createdAt: "2026-04-15T12:12:00.000Z",
      reviewedAt: null,
      reviewedBy: null,
      acceptedInto: []
    });

    const apiClient = {
      listSpaces: vi.fn().mockResolvedValue([{ id: "space-default", name: "默认空间" }]),
      listRooms: vi.fn().mockResolvedValue([
        {
          id: "room-1",
          spaceId: "space-default",
          name: "主协作间",
          participantIds: []
        }
      ]),
      createRoom: vi.fn(),
      listMessages: vi.fn().mockResolvedValue([]),
      createMessage: vi.fn().mockResolvedValue({
        eventId: "evt-human-mention",
        kind: "message.created",
        roomId: "room-1",
        timestamp: "2026-04-15T12:02:00.000Z",
        payload: {
          messageId: "msg-human-mention",
          speakerParticipantId: "human-1",
          body: "@实时助手 你怎么看这个方向？"
        }
      }),
      uploadFile: vi.fn(),
      listParticipants: vi.fn().mockResolvedValue([
        {
          id: "agent-realtime",
          type: "agent",
          displayName: "实时助手",
          bridgeKind: "generic",
          capabilities: ["chat"],
          createdAt: "2026-04-15T12:00:00.000Z",
          lastSeenAt: "2026-04-15T12:00:00.000Z"
        }
      ]),
      listBridgeTokens: vi.fn().mockResolvedValue([]),
      createBridgeToken: vi.fn(),
      revokeBridgeToken: vi.fn(),
      listBridgeSessions: vi.fn().mockResolvedValue([
        {
          id: "session-1",
          tokenId: "token-1",
          agentId: "agent-realtime",
          status: "connected",
          activeRoomIds: ["room-1"],
          connectedAt: "2026-04-15T12:00:00.000Z",
          lastSeenAt: "2026-04-15T12:00:00.000Z",
          expiresAt: "2026-04-15T12:02:00.000Z"
        }
      ]),
      listMemoryCandidates: vi.fn().mockResolvedValue([
        {
          candidateId: "cand-1",
          roomId: "room-1",
          scope: "shared",
          candidateType: "todo",
          title: "补 rollout checklist",
          body: "We need a rollout checklist before release.",
          status: "proposed",
          proposedBy: "observer",
          sourceEventIds: ["evt-1"],
          sourceMemoryIds: [],
          targetAgentId: null,
          createdAt: "2026-04-15T12:00:00.000Z",
          reviewedAt: null,
          reviewedBy: null,
          acceptedInto: []
        }
      ]),
      listSharedKnowledge: vi.fn().mockResolvedValue([
        {
          knowledgeId: "know-1",
          spaceId: "space-default",
          roomId: "room-1",
          kind: "decision",
          title: "采用候选审核",
          body: "Route private sharing through candidate review.",
          keywords: ["review"],
          sourceCandidateId: "cand-1",
          sourceEventIds: ["evt-1"],
          createdAt: "2026-04-15T12:10:00.000Z",
          updatedAt: "2026-04-15T12:10:00.000Z"
        }
      ]),
      listPrivateMemoryOverview: vi.fn().mockResolvedValue([
        {
          agentId: "agent-codex",
          roomId: "room-1",
          totalMemories: 1,
          shareableMemories: 1,
          latestUpdatedAt: "2026-04-15T12:11:00.000Z",
          latestSourceEventIds: ["evt-private-1"],
          suggestedShareCandidate: {
            memoryId: "mem-private-1",
            candidateType: "decision"
          }
        }
      ]),
      getWorkMemory: vi.fn().mockResolvedValue({
        roomId: "room-1",
        recentMessages: [],
        activeParticipantIds: ["human-1", "agent-realtime"],
        todoItems: ["补工作记忆面板"],
        blockerItems: ["等待审核反馈"],
        decisionItems: ["先做共享层 UI"],
        lastSummaryDraftId: "cand-summary-1",
        updatedAt: "2026-04-15T12:10:00.000Z"
      }),
      acceptMemoryCandidate: vi.fn(),
      rejectMemoryCandidate: vi.fn(),
      sharePrivateMemoryAsCandidate,
      listRoomSummaries: vi.fn().mockResolvedValue([
        {
          roomId: "room-1",
          generatedAt: "2026-04-15T12:00:00.000Z",
          messageCount: 2,
          participantCount: 2,
          summaryText: 'Room room-1 has 2 messages from 2 participants. Latest message: "来自实时链路"',
          sourceEventRange: {
            firstMessageId: "msg-1",
            lastMessageId: "msg-2"
          }
        }
      ])
    } as unknown as ApiClient;

    const handlers: {
      presence?: (payload: {
        roomId: string;
        participant: { id: string; type: string; displayName: string };
      }) => void;
      message?: (payload: {
        roomId: string;
        participant: { id: string; type: string; displayName: string };
        message: {
          eventId: string;
          kind: string;
          roomId: string;
          timestamp: string;
          payload: {
            messageId: string;
            speakerParticipantId: string;
            body: string;
          };
        };
      }) => void;
    } = {};

    const joinRoom = vi.fn();

    const createSocketClient = vi.fn(
      (): RoomSocketClient => ({
        joinRoom,
        publishPresence: vi.fn(),
        publishMessage: vi.fn(),
        onPresence(handler) {
          handlers.presence = handler;
          return () => undefined;
        },
        onMessage(handler) {
          handlers.message = handler;
          return () => undefined;
        },
        dispose: vi.fn()
      })
    );

    const onOpenAgentWorkspace = vi.fn();

    render(
      <RoomShell
        apiClient={apiClient}
        createSocketClient={createSocketClient}
        onOpenAgentWorkspace={onOpenAgentWorkspace}
      />
    );

    expect(await screen.findByText("已接入默认协作空间")).toBeInTheDocument();
    await waitFor(() => {
      expect(joinRoom).toHaveBeenCalledWith({
        roomId: "room-1",
        participant: {
          id: "human-1",
          type: "human",
          displayName: "你"
        }
      });
    });

    await act(async () => {
      handlers.presence?.({
        roomId: "room-1",
        participant: {
          id: "agent-realtime",
          type: "agent",
          displayName: "实时助手"
        }
      });
    });

    expect((await screen.findAllByText("实时助手")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "从成员列表对 实时助手 说" }));
    expect(screen.getByPlaceholderText("输入你要同步到当前房间的内容")).toHaveValue("@实时助手 ");
    expect(await screen.findByText("桥接会话")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开 实时助手 工作台" }));
    expect(onOpenAgentWorkspace).toHaveBeenCalledWith({
      roomId: "room-1",
      agentId: "agent-realtime",
      sessionId: "session-1"
    });

    await act(async () => {
      handlers.message?.({
        roomId: "room-1",
        participant: {
          id: "agent-realtime",
          type: "agent",
          displayName: "实时助手"
        },
        message: {
          eventId: "evt-1",
          kind: "message.created",
          roomId: "room-1",
          timestamp: "2026-04-15T12:00:00.000Z",
          payload: {
            messageId: "msg-1",
            speakerParticipantId: "agent-realtime",
            body: "来自实时链路"
          }
        }
      });
    });

    expect(await screen.findByText("来自实时链路")).toBeInTheDocument();
    expect((await screen.findAllByText(/Room room-1 has 2 messages/)).length).toBeGreaterThan(0);
    expect(await screen.findByText("候选审核")).toBeInTheDocument();
    expect(await screen.findByText("补 rollout checklist")).toBeInTheDocument();
    expect(await screen.findByText("共享知识")).toBeInTheDocument();
    expect(await screen.findByText("采用候选审核")).toBeInTheDocument();
    expect(await screen.findByText("当前工作记忆")).toBeInTheDocument();
    expect(await screen.findByText("补工作记忆面板")).toBeInTheDocument();
    expect(await screen.findByText("等待审核反馈")).toBeInTheDocument();
    expect(await screen.findByText("先做共享层 UI")).toBeInTheDocument();
    expect(await screen.findByText("私有记忆状态")).toBeInTheDocument();
    expect(await screen.findByText("agent-codex")).toBeInTheDocument();
    expect(screen.queryByText("This should stay in codex private scope.")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "对 实时助手 说" }));
      fireEvent.change(screen.getByPlaceholderText("输入你要同步到当前房间的内容"), {
        target: {
          value: "@实时助手 你怎么看这个方向？"
        }
      });
      fireEvent.click(screen.getByRole("button", { name: "发送" }));
    });

    await waitFor(() => {
      expect(apiClient.createMessage).toHaveBeenCalledWith({
        roomId: "room-1",
        speakerParticipantId: "human-1",
        body: "@实时助手 你怎么看这个方向？"
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回复 Agent realtime 的消息" }));
    });

    expect(screen.getByPlaceholderText("输入你要同步到当前房间的内容")).toHaveValue(
      "> 回复 agent-realtime: 来自实时链路\n\n"
    );

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("输入你要同步到当前房间的内容"), {
        target: {
          value: "> 回复 agent-realtime: 来自实时链路\n\n我接着这个点说。"
        }
      });
      fireEvent.click(screen.getByRole("button", { name: "发送" }));
    });

    await waitFor(() => {
      expect(apiClient.createMessage).toHaveBeenLastCalledWith({
        roomId: "room-1",
        speakerParticipantId: "human-1",
        body: "> 回复 agent-realtime: 来自实时链路\n\n我接着这个点说。"
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "提交为共享候选" }));
    });

    await waitFor(() => {
      expect(sharePrivateMemoryAsCandidate).toHaveBeenCalledWith({
        memoryId: "mem-private-1",
        agentId: "agent-codex",
        candidateType: "decision"
      });
    });
  });

  it("uploads a file as a formal attachment message instead of a system URL notice", async () => {
    const createMessage = vi.fn().mockResolvedValue({
      eventId: "evt-upload-1",
      kind: "message.created",
      roomId: "room-1",
      timestamp: "2026-04-30T11:00:00.000Z",
      payload: {
        messageId: "msg-upload-1",
        speakerParticipantId: "human-1",
        body: "",
        attachments: [
          {
            id: "att-upload-1",
            messageId: "msg-upload-1",
            kind: "image",
            url: "https://example.com/uploads/diagram.png",
            name: "diagram.png",
            mimeType: "image/png",
            sizeBytes: 2048
          }
        ]
      }
    });

    const apiClient = {
      listSpaces: vi.fn().mockResolvedValue([{ id: "space-default", name: "默认空间" }]),
      listRooms: vi.fn().mockResolvedValue([
        {
          id: "room-1",
          spaceId: "space-default",
          name: "主协作间",
          participantIds: []
        }
      ]),
      createRoom: vi.fn(),
      listMessages: vi.fn().mockResolvedValue([]),
      createMessage,
      uploadFile: vi.fn().mockResolvedValue({
        attachment: {
          id: "att-upload-1",
          messageId: "",
          kind: "image",
          url: "https://example.com/uploads/diagram.png",
          name: "diagram.png",
          mimeType: "image/png",
          sizeBytes: 2048
        },
        originalName: "diagram.png",
        mimeType: "image/png",
        sizeBytes: 2048
      }),
      listParticipants: vi.fn().mockResolvedValue([]),
      listBridgeTokens: vi.fn().mockResolvedValue([]),
      createBridgeToken: vi.fn(),
      revokeBridgeToken: vi.fn(),
      listBridgeSessions: vi.fn().mockResolvedValue([]),
      listMemoryCandidates: vi.fn().mockResolvedValue([]),
      listSharedKnowledge: vi.fn().mockResolvedValue([]),
      listPrivateMemoryOverview: vi.fn().mockResolvedValue([]),
      getWorkMemory: vi.fn().mockResolvedValue({
        roomId: "room-1",
        recentMessages: [],
        activeParticipantIds: [],
        todoItems: [],
        blockerItems: [],
        decisionItems: [],
        lastSummaryDraftId: null,
        updatedAt: "2026-04-30T00:00:00.000Z"
      }),
      acceptMemoryCandidate: vi.fn(),
      rejectMemoryCandidate: vi.fn(),
      sharePrivateMemoryAsCandidate: vi.fn(),
      listRoomSummaries: vi.fn().mockResolvedValue([])
    } as unknown as ApiClient;

    const { container } = render(
      <RoomShell
        apiClient={apiClient}
        createSocketClient={() => ({
          joinRoom: vi.fn(),
          publishPresence: vi.fn(),
          publishMessage: vi.fn(),
          onPresence: () => () => undefined,
          onMessage: () => () => undefined,
          dispose: vi.fn()
        })}
      />
    );

    expect(await screen.findByText("已接入默认协作空间")).toBeInTheDocument();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    await act(async () => {
      fireEvent.change(fileInput as HTMLInputElement, {
        target: {
          files: [new File(["fake image"], "diagram.png", { type: "image/png" })]
        }
      });
    });

    await waitFor(() => {
      expect(createMessage).toHaveBeenCalledWith({
        roomId: "room-1",
        speakerParticipantId: "human-1",
        body: "",
        attachments: [
          expect.objectContaining({
            id: "att-upload-1",
            kind: "image",
            url: "https://example.com/uploads/diagram.png",
            name: "diagram.png",
            mimeType: "image/png",
            sizeBytes: 2048
          })
        ]
      });
    });

    expect(await screen.findByText("diagram.png")).toBeInTheDocument();
    expect(screen.queryByText(/已上传/)).not.toBeInTheDocument();
  });

  it("shows pending review state for private memory that already has a proposed shared candidate", async () => {
    const apiClient = {
      listSpaces: vi.fn().mockResolvedValue([{ id: "space-default", name: "默认空间" }]),
      listRooms: vi.fn().mockResolvedValue([
        {
          id: "room-1",
          spaceId: "space-default",
          name: "主协作间",
          participantIds: []
        }
      ]),
      createRoom: vi.fn(),
      listMessages: vi.fn().mockResolvedValue([]),
      createMessage: vi.fn(),
      uploadFile: vi.fn(),
      listParticipants: vi.fn().mockResolvedValue([]),
      listBridgeTokens: vi.fn().mockResolvedValue([]),
      createBridgeToken: vi.fn(),
      revokeBridgeToken: vi.fn(),
      listBridgeSessions: vi.fn().mockResolvedValue([]),
      listMemoryCandidates: vi.fn().mockResolvedValue([]),
      listSharedKnowledge: vi.fn().mockResolvedValue([]),
      listPrivateMemoryOverview: vi.fn().mockResolvedValue([
        {
          agentId: "agent-codex",
          roomId: "room-1",
          totalMemories: 1,
          shareableMemories: 0,
          latestUpdatedAt: "2026-04-15T12:11:00.000Z",
          latestSourceEventIds: ["evt-private-1"],
          suggestedShareCandidate: null,
          pendingShareCandidate: {
            candidateId: "cand-private-1",
            memoryId: "mem-private-1",
            candidateType: "decision",
            submittedAt: "2026-04-15T12:12:00.000Z"
          },
          latestShareOutcome: null
        }
      ]),
      getWorkMemory: vi.fn().mockResolvedValue({
        roomId: "room-1",
        recentMessages: [],
        activeParticipantIds: [],
        todoItems: [],
        blockerItems: [],
        decisionItems: [],
        lastSummaryDraftId: null,
        updatedAt: "2026-04-15T12:10:00.000Z"
      }),
      acceptMemoryCandidate: vi.fn(),
      rejectMemoryCandidate: vi.fn(),
      sharePrivateMemoryAsCandidate: vi.fn(),
      listRoomSummaries: vi.fn().mockResolvedValue([])
    } as unknown as ApiClient;

    render(
      <RoomShell
        apiClient={apiClient}
        createSocketClient={() => ({
          joinRoom: vi.fn(),
          publishPresence: vi.fn(),
          publishMessage: vi.fn(),
          onPresence: () => () => undefined,
          onMessage: () => () => undefined,
          dispose: vi.fn()
        })}
      />
    );

    expect(await screen.findByText("私有记忆状态")).toBeInTheDocument();
    expect(await screen.findByText("已提交待审核")).toBeInTheDocument();
    expect(screen.getByText("提交于 2026-04-15T12:12:00.000Z")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看候选 cand-private-1" })).toHaveAttribute(
      "href",
      "#candidate-cand-private-1"
    );
    expect(screen.getByText("1 条私有记忆 / 0 条可提交候选")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提交为共享候选" })).not.toBeInTheDocument();
  });

  it("shows accepted private memory outcome after candidate review succeeds", async () => {
    const apiClient = {
      listSpaces: vi.fn().mockResolvedValue([{ id: "space-default", name: "默认空间" }]),
      listRooms: vi.fn().mockResolvedValue([
        {
          id: "room-1",
          spaceId: "space-default",
          name: "主协作间",
          participantIds: []
        }
      ]),
      createRoom: vi.fn(),
      listMessages: vi.fn().mockResolvedValue([]),
      createMessage: vi.fn(),
      uploadFile: vi.fn(),
      listParticipants: vi.fn().mockResolvedValue([]),
      listBridgeTokens: vi.fn().mockResolvedValue([]),
      createBridgeToken: vi.fn(),
      revokeBridgeToken: vi.fn(),
      listBridgeSessions: vi.fn().mockResolvedValue([]),
      listMemoryCandidates: vi.fn().mockResolvedValue([]),
      listSharedKnowledge: vi.fn().mockResolvedValue([]),
      listPrivateMemoryOverview: vi.fn().mockResolvedValue([
        {
          agentId: "agent-codex",
          roomId: "room-1",
          totalMemories: 1,
          shareableMemories: 1,
          latestUpdatedAt: "2026-04-15T12:11:00.000Z",
          latestSourceEventIds: ["evt-private-1"],
          suggestedShareCandidate: {
            memoryId: "mem-private-1",
            candidateType: "decision"
          },
          pendingShareCandidate: null,
          latestShareOutcome: {
            candidateId: "cand-private-1",
            memoryId: "mem-private-1",
            candidateType: "decision",
            status: "accepted",
            reviewedAt: "2026-04-15T12:20:00.000Z"
          }
        }
      ]),
      getWorkMemory: vi.fn().mockResolvedValue({
        roomId: "room-1",
        recentMessages: [],
        activeParticipantIds: [],
        todoItems: [],
        blockerItems: [],
        decisionItems: [],
        lastSummaryDraftId: null,
        updatedAt: "2026-04-15T12:10:00.000Z"
      }),
      acceptMemoryCandidate: vi.fn(),
      rejectMemoryCandidate: vi.fn(),
      sharePrivateMemoryAsCandidate: vi.fn(),
      listRoomSummaries: vi.fn().mockResolvedValue([])
    } as unknown as ApiClient;

    render(
      <RoomShell
        apiClient={apiClient}
        createSocketClient={() => ({
          joinRoom: vi.fn(),
          publishPresence: vi.fn(),
          publishMessage: vi.fn(),
          onPresence: () => () => undefined,
          onMessage: () => () => undefined,
          dispose: vi.fn()
        })}
      />
    );

    expect(await screen.findByText("已接受进入共享层")).toBeInTheDocument();
    expect(screen.getByText("审核于 2026-04-15T12:20:00.000Z")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交为共享候选" })).toBeInTheDocument();
  });

  it("shows rejected private memory outcome after candidate review fails", async () => {
    const apiClient = {
      listSpaces: vi.fn().mockResolvedValue([{ id: "space-default", name: "默认空间" }]),
      listRooms: vi.fn().mockResolvedValue([
        {
          id: "room-1",
          spaceId: "space-default",
          name: "主协作间",
          participantIds: []
        }
      ]),
      createRoom: vi.fn(),
      listMessages: vi.fn().mockResolvedValue([]),
      createMessage: vi.fn(),
      uploadFile: vi.fn(),
      listParticipants: vi.fn().mockResolvedValue([]),
      listBridgeTokens: vi.fn().mockResolvedValue([]),
      createBridgeToken: vi.fn(),
      revokeBridgeToken: vi.fn(),
      listBridgeSessions: vi.fn().mockResolvedValue([]),
      listMemoryCandidates: vi.fn().mockResolvedValue([]),
      listSharedKnowledge: vi.fn().mockResolvedValue([]),
      listPrivateMemoryOverview: vi.fn().mockResolvedValue([
        {
          agentId: "agent-codex",
          roomId: "room-1",
          totalMemories: 1,
          shareableMemories: 1,
          latestUpdatedAt: "2026-04-15T12:11:00.000Z",
          latestSourceEventIds: ["evt-private-1"],
          suggestedShareCandidate: {
            memoryId: "mem-private-1",
            candidateType: "decision"
          },
          pendingShareCandidate: null,
          latestShareOutcome: {
            candidateId: "cand-private-2",
            memoryId: "mem-private-1",
            candidateType: "decision",
            status: "rejected",
            reviewedAt: "2026-04-15T12:22:00.000Z"
          }
        }
      ]),
      getWorkMemory: vi.fn().mockResolvedValue({
        roomId: "room-1",
        recentMessages: [],
        activeParticipantIds: [],
        todoItems: [],
        blockerItems: [],
        decisionItems: [],
        lastSummaryDraftId: null,
        updatedAt: "2026-04-15T12:10:00.000Z"
      }),
      acceptMemoryCandidate: vi.fn(),
      rejectMemoryCandidate: vi.fn(),
      sharePrivateMemoryAsCandidate: vi.fn(),
      listRoomSummaries: vi.fn().mockResolvedValue([])
    } as unknown as ApiClient;

    render(
      <RoomShell
        apiClient={apiClient}
        createSocketClient={() => ({
          joinRoom: vi.fn(),
          publishPresence: vi.fn(),
          publishMessage: vi.fn(),
          onPresence: () => () => undefined,
          onMessage: () => () => undefined,
          dispose: vi.fn()
        })}
      />
    );

    expect(await screen.findByText("已拒绝，等待重新判断")).toBeInTheDocument();
    expect(screen.getByText("审核于 2026-04-15T12:22:00.000Z")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交为共享候选" })).toBeInTheDocument();
  });
});
