import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchBridgeWorkspaceEvents,
  fetchBridgeWorkspaceSnapshot,
  sendBridgeWorkspaceMessage
} from "../features/agent-workspace/bridge-workspace-client";

vi.mock("../features/agent-workspace/bridge-workspace-client", () => {
  return {
    fetchBridgeWorkspaceSnapshot: vi.fn(),
    fetchBridgeWorkspaceEvents: vi.fn(),
    sendBridgeWorkspaceMessage: vi.fn()
  };
});

import { App } from "../App";

describe("AgentWorkspacePage", () => {
  beforeEach(() => {
    window.history.pushState(
      {},
      "",
      "/?view=agent-workspace&roomId=room-1&agentId=agent-codex-main&sessionId=session-1"
    );
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

    vi.mocked(fetchBridgeWorkspaceSnapshot).mockResolvedValue({
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
          id: "agent-codex-main",
          type: "agent",
          displayName: "Codex",
          bridgeKind: "codex",
          capabilities: ["chat", "code"],
          lastSeenAt: "2026-05-10T00:00:00.000Z"
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
      recentEvents: [
        {
          eventId: "evt-2",
          kind: "message.created",
          roomId: "room-1",
          timestamp: "2026-05-10T00:00:00.000Z",
          payload: {
            messageId: "msg-2",
            speakerParticipantId: "human-1",
            body: "请继续处理这个房间。"
          }
        }
      ],
      nextCursor: "evt-2"
    });

    vi.mocked(fetchBridgeWorkspaceEvents).mockResolvedValueOnce({
      items: [
        {
          eventId: "evt-3",
          kind: "message.created",
          roomId: "room-1",
          timestamp: "2026-05-10T00:00:05.000Z",
          payload: {
            messageId: "msg-3",
            speakerParticipantId: "agent-codex-main",
            body: "收到，开始接续。"
          }
        }
      ],
      nextCursor: "evt-3"
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

    expect(screen.getByText("Codex")).toBeInTheDocument();
    expect(screen.getByText("统一工作台")).toBeInTheDocument();
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
        afterEventId: "evt-2"
      })
    );

    expect(screen.getByText("收到，开始接续。")).toBeInTheDocument();
  });

  it("sends a bridge workspace message from the composer", async () => {
    vi.mocked(fetchBridgeWorkspaceSnapshot).mockResolvedValue({
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
      recentEvents: [],
      nextCursor: null
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
  });
});
