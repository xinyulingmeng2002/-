import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentPanel } from "../features/agents/agent-panel";

describe("AgentPanel", () => {
  it("renders online agents and bridge token actions", async () => {
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
      />
    );

    expect(screen.getAllByText("Codex").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "创建接入令牌" })).toBeInTheDocument();
  });
});
