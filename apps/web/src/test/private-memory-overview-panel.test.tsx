import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrivateMemoryOverviewPanel } from "../features/agents/private-memory-overview-panel";

describe("PrivateMemoryOverviewPanel", () => {
  it("renders redacted private memory status without showing raw memory body", () => {
    const onShareCandidate = vi.fn().mockResolvedValue(undefined);

    render(
      <PrivateMemoryOverviewPanel
        items={[
          {
            agentId: "agent-codex",
            roomId: "room-1",
            totalMemories: 1,
            shareableMemories: 1,
            latestUpdatedAt: "2026-05-09T12:00:00.000Z",
            latestSourceEventIds: ["evt-1"],
            suggestedShareCandidate: {
              memoryId: "mem-1",
              candidateType: "decision"
            },
            pendingShareCandidate: null,
            latestShareOutcome: null
          }
        ]}
        resolveDisplayName={(agentId) => (agentId === "agent-codex" ? "Codex" : agentId)}
        onShareCandidate={onShareCandidate}
      />
    );

    expect(screen.getByText("私有记忆状态")).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();
    expect(screen.getByText("1 条私有记忆 / 1 条可提交候选")).toBeInTheDocument();
    expect(screen.queryByText("Route this note through candidate review once.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "提交为共享候选" }));

    expect(onShareCandidate).toHaveBeenCalledWith({
      agentId: "agent-codex",
      candidateType: "decision",
      memoryId: "mem-1"
    });
  });

  it("shows pending review state instead of share action when a candidate is already proposed", () => {
    const onShareCandidate = vi.fn().mockResolvedValue(undefined);

    render(
      <PrivateMemoryOverviewPanel
        items={[
          {
            agentId: "agent-codex",
            roomId: "room-1",
            totalMemories: 1,
            shareableMemories: 0,
            latestUpdatedAt: "2026-05-09T12:00:00.000Z",
            latestSourceEventIds: ["evt-1"],
            suggestedShareCandidate: null,
            pendingShareCandidate: {
              candidateId: "cand-1",
              candidateType: "decision",
              memoryId: "mem-1",
              submittedAt: "2026-05-09T12:05:00.000Z"
            },
            latestShareOutcome: null
          }
        ]}
        resolveDisplayName={(agentId) => (agentId === "agent-codex" ? "Codex" : agentId)}
        onShareCandidate={onShareCandidate}
      />
    );

    expect(screen.getByText("1 条私有记忆 / 0 条可提交候选")).toBeInTheDocument();
    expect(screen.getByText("已提交待审核")).toBeInTheDocument();
    expect(screen.getByText("提交于 2026-05-09T12:05:00.000Z")).toBeInTheDocument();
    const candidateLink = screen.getByRole("link", { name: "查看候选 cand-1" });
    expect(candidateLink).toHaveAttribute("href", "#candidate-cand-1");
    expect(screen.queryByRole("button", { name: "提交为共享候选" })).not.toBeInTheDocument();
    expect(screen.queryByText("Share this through review.")).not.toBeInTheDocument();
  });

  it("shows accepted outcome after the shared candidate is approved", () => {
    const onShareCandidate = vi.fn().mockResolvedValue(undefined);

    render(
      <PrivateMemoryOverviewPanel
        items={[
          {
            agentId: "agent-codex",
            roomId: "room-1",
            totalMemories: 1,
            shareableMemories: 1,
            latestUpdatedAt: "2026-05-09T12:00:00.000Z",
            latestSourceEventIds: ["evt-1"],
            suggestedShareCandidate: {
              memoryId: "mem-1",
              candidateType: "decision"
            },
            pendingShareCandidate: null,
            latestShareOutcome: {
              candidateId: "cand-1",
              candidateType: "decision",
              memoryId: "mem-1",
              status: "accepted",
              reviewedAt: "2026-05-09T12:10:00.000Z"
            }
          }
        ]}
        resolveDisplayName={(agentId) => (agentId === "agent-codex" ? "Codex" : agentId)}
        onShareCandidate={onShareCandidate}
      />
    );

    expect(screen.getByText("已接受进入共享层")).toBeInTheDocument();
    expect(screen.getByText("审核于 2026-05-09T12:10:00.000Z")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交为共享候选" })).toBeInTheDocument();
    expect(screen.queryByText("Share this and accept it.")).not.toBeInTheDocument();
  });

  it("shows rejected outcome after the shared candidate is declined", () => {
    const onShareCandidate = vi.fn().mockResolvedValue(undefined);

    render(
      <PrivateMemoryOverviewPanel
        items={[
          {
            agentId: "agent-codex",
            roomId: "room-1",
            totalMemories: 1,
            shareableMemories: 1,
            latestUpdatedAt: "2026-05-09T12:00:00.000Z",
            latestSourceEventIds: ["evt-1"],
            suggestedShareCandidate: {
              memoryId: "mem-1",
              candidateType: "decision"
            },
            pendingShareCandidate: null,
            latestShareOutcome: {
              candidateId: "cand-2",
              candidateType: "decision",
              memoryId: "mem-1",
              status: "rejected",
              reviewedAt: "2026-05-09T12:12:00.000Z"
            }
          }
        ]}
        resolveDisplayName={(agentId) => (agentId === "agent-codex" ? "Codex" : agentId)}
        onShareCandidate={onShareCandidate}
      />
    );

    expect(screen.getByText("已拒绝，等待重新判断")).toBeInTheDocument();
    expect(screen.getByText("审核于 2026-05-09T12:12:00.000Z")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交为共享候选" })).toBeInTheDocument();
    expect(screen.queryByText("Share this and reject it.")).not.toBeInTheDocument();
  });
});
