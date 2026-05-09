import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrivateMemoryOverviewPanel } from "../features/agents/private-memory-overview-panel";

describe("PrivateMemoryOverviewPanel", () => {
  it("renders redacted private memory status without showing raw memory body", () => {
    render(
      <PrivateMemoryOverviewPanel
        items={[
          {
            agentId: "agent-codex",
            roomId: "room-1",
            totalMemories: 1,
            shareableMemories: 1,
            latestUpdatedAt: "2026-05-09T12:00:00.000Z",
            latestSourceEventIds: ["evt-1"]
          }
        ]}
        resolveDisplayName={(agentId) => (agentId === "agent-codex" ? "Codex" : agentId)}
      />
    );

    expect(screen.getByText("私有记忆状态")).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();
    expect(screen.getByText("1 条私有记忆 / 1 条可提交候选")).toBeInTheDocument();
    expect(screen.queryByText("Route this note through candidate review once.")).not.toBeInTheDocument();
  });
});
