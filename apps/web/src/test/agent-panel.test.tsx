import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentPanel } from "../features/agents/agent-panel";

describe("AgentPanel", () => {
  it("renders online agents, bridge token actions, and candidate review actions", async () => {
    const onAcceptCandidate = vi.fn().mockResolvedValue(undefined);
    const onRejectCandidate = vi.fn().mockResolvedValue(undefined);

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
            expiresAt: "2026-04-15T12:02:00.000Z"
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
            shareableMemories: 1,
            latestUpdatedAt: "2026-04-15T12:10:00.000Z",
            latestSourceEventIds: ["evt-private-1"]
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
        onCreateToken={vi.fn().mockResolvedValue({
          token: "secret-token",
          metadata: {
            id: "token-1",
            label: "Codex bridge",
            bridgeKind: "codex",
            allowedRoomIds: ["room-1"],
            createdAt: "2026-04-15T12:00:00.000Z",
            revokedAt: null
          }
        })}
        onRevokeToken={vi.fn().mockResolvedValue(undefined)}
        onAcceptCandidate={onAcceptCandidate}
        onRejectCandidate={onRejectCandidate}
      />
    );

    expect(screen.getAllByText("Codex").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "创建接入令牌" })).toBeInTheDocument();
    expect(screen.getByText("候选审核")).toBeInTheDocument();
    expect(screen.getByText("补 rollout checklist")).toBeInTheDocument();
    expect(screen.getByText("共享知识")).toBeInTheDocument();
    expect(screen.getByText("采用候选审核")).toBeInTheDocument();
    expect(screen.getByText("私有记忆状态")).toBeInTheDocument();
    expect(screen.getByText("1 条私有记忆 / 1 条可提交候选")).toBeInTheDocument();
    expect(screen.getByText("当前工作记忆")).toBeInTheDocument();
    expect(screen.getByText("补工作记忆面板")).toBeInTheDocument();

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
  });
});
