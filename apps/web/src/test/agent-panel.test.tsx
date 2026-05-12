import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentPanel } from "../features/agents/agent-panel";

describe("AgentPanel", () => {
  it("renders online agents, bridge token actions, and candidate review actions", async () => {
    window.location.hash = "#candidate-cand-1";
    const onAcceptCandidate = vi.fn().mockResolvedValue(undefined);
    const onRejectCandidate = vi.fn().mockResolvedValue(undefined);
    const onSharePrivateMemory = vi.fn().mockResolvedValue(undefined);
    const onOpenAgentWorkspace = vi.fn();
    const onDisconnectSession = vi.fn().mockResolvedValue(undefined);
    const onCreateToken = vi.fn().mockResolvedValue({
      token: "secret-token",
      invite: {
        type: "multi-agent-room-invite",
        version: "1",
        label: "Codex bridge",
        bridgeKind: "codex",
        roomIds: ["room-1"],
        primaryRoomId: "room-1",
        baseUrl: "http://localhost:5173",
        token: "secret-token",
        endpoints: {
          connect: "/api/bridge/ingress/connect",
          joinRoom: "/api/bridge/ingress/join-room",
          heartbeat: "/api/bridge/ingress/heartbeat",
          disconnect: "/api/bridge/ingress/disconnect",
          pullEvents: "/api/bridge/egress/events",
          workspace: "/api/bridge/egress/workspace",
          sendMessage: "/api/bridge/ingress/message",
          uploadFile: "/api/uploads"
        },
        identityRules: {
          mustDeclareAgentIdentity: true,
          mustNotImpersonateHuman: true,
          bridgeOnlyTransportsMessages: true,
          privateMemoryRequiresReview: true
        },
        ownerControls: {
          canRevokeToken: true,
          canDisconnectSession: true
        }
      },
      metadata: {
        id: "token-1",
        label: "Codex bridge",
        bridgeKind: "codex",
        allowedRoomIds: ["room-1"],
        createdAt: "2026-04-15T12:00:00.000Z",
        revokedAt: null
      }
    });

    render(
      <AgentPanel
        activeRoomId="room-1"
        participants={[
          {
            id: "agent-codex",
            type: "agent",
            displayName: "Codex",
            bridgeKind: "codex",
            capabilities: ["chat"],
            createdAt: "2026-04-15T12:00:00.000Z",
            lastSeenAt: "2026-04-15T12:00:00.000Z"
          },
          {
            id: "agent-openclaw",
            type: "agent",
            displayName: "OpenClaw",
            bridgeKind: "openclaw",
            capabilities: ["chat"],
            createdAt: "2026-04-15T12:00:00.000Z",
            lastSeenAt: "2026-04-15T12:03:00.000Z"
          }
        ]}
        sessions={[
          {
            id: "session-1",
            tokenId: "token-1",
            agentId: "agent-codex",
            status: "connected",
            activeRoomIds: ["room-1"],
            connectedAt: "2026-04-15T12:00:00.000Z",
            lastSeenAt: "2026-04-15T12:00:00.000Z",
            expiresAt: "2026-04-15T12:02:00.000Z",
            health: {
              state: "online",
              reason: "heartbeat_fresh",
              lastSeenSecondsAgo: 30,
              expiresInSeconds: 90
            },
            diagnostics: {
              lastEventId: "evt-10",
              reconnectCount: 2,
              consecutiveFailures: 1,
              lastError: "bridge_request_failed:503",
              lastReportedAt: "2026-04-15T12:01:00.000Z"
            }
          },
          {
            id: "session-2",
            tokenId: "token-2",
            agentId: "agent-openclaw",
            status: "disconnected",
            activeRoomIds: ["room-1"],
            connectedAt: "2026-04-15T12:00:00.000Z",
            lastSeenAt: "2026-04-15T12:03:00.000Z",
            expiresAt: "2026-04-15T12:04:59.000Z",
            health: {
              state: "offline",
              reason: "heartbeat_expired",
              lastSeenSecondsAgo: 120,
              expiresInSeconds: -1
            }
          }
        ]}
        tokens={[]}
        candidates={[
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
        ]}
        sharedKnowledge={[
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
        ]}
        privateMemoryOverview={[
          {
            agentId: "agent-codex",
            roomId: "room-1",
            totalMemories: 1,
            shareableMemories: 0,
            latestUpdatedAt: "2026-04-15T12:10:00.000Z",
            latestSourceEventIds: ["evt-private-1"],
            suggestedShareCandidate: null,
            pendingShareCandidate: {
              candidateId: "cand-1",
              memoryId: "mem-private-1",
              candidateType: "decision",
              submittedAt: "2026-04-15T12:05:00.000Z"
            },
            latestShareOutcome: null
          }
        ]}
        workMemory={{
          roomId: "room-1",
          recentMessages: [],
          activeParticipantIds: ["human-1", "agent-codex"],
          todoItems: ["补工作记忆面板"],
          blockerItems: ["等待审核反馈"],
          decisionItems: ["先做共享层 UI"],
          lastSummaryDraftId: "cand-summary-1",
          updatedAt: "2026-04-15T12:10:00.000Z"
        }}
        latestSummary={null}
        onCreateToken={onCreateToken}
        onRevokeToken={vi.fn().mockResolvedValue(undefined)}
        onAcceptCandidate={onAcceptCandidate}
        onRejectCandidate={onRejectCandidate}
        onSharePrivateMemory={onSharePrivateMemory}
        onOpenAgentWorkspace={onOpenAgentWorkspace}
        onDisconnectSession={onDisconnectSession}
      />
    );

    expect(screen.getAllByText("Codex").length).toBeGreaterThan(0);
    expect(screen.getAllByText("OpenClaw").length).toBeGreaterThan(0);
    expect(screen.getByText("房间智能体")).toBeInTheDocument();
    expect(screen.getByText("房间里的 Agent 是群成员，不只是 bridge session。")).toBeInTheDocument();
    expect(screen.getByText("codex · chat")).toBeInTheDocument();
    expect(screen.getByText("openclaw · chat")).toBeInTheDocument();
    expect(screen.getByText("在线 · 最后活跃 2026-04-15T12:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("离线 · 最后活跃 2026-04-15T12:03:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("offline")).toBeInTheDocument();
    expect(screen.getByText("heartbeat_expired")).toBeInTheDocument();
    expect(screen.getByText("最后心跳 120 秒前")).toBeInTheDocument();
    expect(screen.getByText("Cursor evt-10")).toBeInTheDocument();
    expect(screen.getByText("重连 2 次 · 连续失败 1 次")).toBeInTheDocument();
    expect(screen.getByText("最近错误 bridge_request_failed:503")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开 Codex 工作台" }));
    expect(onOpenAgentWorkspace).toHaveBeenCalledWith({
      roomId: "room-1",
      agentId: "agent-codex",
      sessionId: "session-1"
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "强制断连 Codex" }));
    });
    await waitFor(() => {
      expect(onDisconnectSession).toHaveBeenCalledWith("session-1");
    });
    expect(screen.getByRole("button", { name: "创建接入令牌" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "创建接入令牌" }));
    });
    await waitFor(() => {
      expect(onCreateToken).toHaveBeenCalledWith({
        label: "codex-bridge",
        bridgeKind: "codex",
        allowedRoomIds: ["room-1"],
        baseUrl: window.location.origin
      });
    });
    expect(screen.getByText("Agent 邀请钥匙")).toBeInTheDocument();
    expect(screen.getByText(/复制以下 JSON/)).toBeInTheDocument();
    expect(screen.getByText(/multi-agent-room-invite/)).toBeInTheDocument();
    expect(screen.getByText(/secret-token/)).toBeInTheDocument();
    expect(screen.getByText("实战接入步骤")).toBeInTheDocument();
    expect(screen.getByText(/保存为 invite\.json/)).toBeInTheDocument();
    expect(screen.getByText(/启动 adapter/)).toBeInTheDocument();
    expect(screen.getAllByText(/events watch/).length).toBeGreaterThan(0);
    expect(screen.getByText(/查看桥接会话诊断/)).toBeInTheDocument();
    expect(screen.getAllByText(/session stop/).length).toBeGreaterThan(0);
    expect(screen.getByText("候选审核")).toBeInTheDocument();
    expect(screen.getByText("补 rollout checklist")).toBeInTheDocument();
    expect(screen.getByText("共享知识")).toBeInTheDocument();
    expect(screen.getByText("采用候选审核")).toBeInTheDocument();
    expect(screen.getByText("私有记忆状态")).toBeInTheDocument();
    expect(screen.getByText("1 条私有记忆 / 0 条可提交候选")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看候选 cand-1" })).toHaveAttribute(
      "href",
      "#candidate-cand-1"
    );
    expect(screen.queryByRole("button", { name: "提交为共享候选" })).not.toBeInTheDocument();
    expect(screen.getByText("当前工作记忆")).toBeInTheDocument();
    expect(screen.getByText("补工作记忆面板")).toBeInTheDocument();
    expect(document.getElementById("candidate-cand-1")).toHaveClass("candidate-card--target");
    expect(document.getElementById("candidate-cand-1")).toHaveAttribute("aria-current", "true");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "接受" }));
    });
    await waitFor(() => {
      expect(onAcceptCandidate).toHaveBeenCalledWith("cand-1");
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "拒绝" }));
    });
    await waitFor(() => {
      expect(onRejectCandidate).toHaveBeenCalledWith("cand-1");
    });

    window.location.hash = "";
  });
});
