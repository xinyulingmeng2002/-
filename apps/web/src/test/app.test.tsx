import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => {
  class MockApiClient {
    async listSpaces() {
      return [{ id: "space-default", name: "默认空间" }];
    }

    async listRooms() {
      return [
        {
          id: "room-1",
          spaceId: "space-default",
          name: "主协作间",
          participantIds: []
        }
      ];
    }

    async createRoom() {
      return {
        id: "room-created",
        spaceId: "space-default",
        name: "主协作间",
        participantIds: []
      };
    }

    async listMessages() {
      return [];
    }

    async createMessage() {
      throw new Error("not implemented in test");
    }

    async uploadFile() {
      throw new Error("not implemented in test");
    }

    async listParticipants() {
      return [];
    }

    async listBridgeTokens() {
      return [];
    }

    async createBridgeToken() {
      return {
        token: "secret-token",
        metadata: {
          id: "token-1",
          label: "codex-bridge",
          bridgeKind: "codex",
          allowedRoomIds: ["room-1"],
          createdAt: "2026-04-15T12:00:00.000Z",
          revokedAt: null
        }
      };
    }

    async revokeBridgeToken() {
      return {
        id: "token-1",
        label: "codex-bridge",
        bridgeKind: "codex",
        allowedRoomIds: ["room-1"],
        createdAt: "2026-04-15T12:00:00.000Z",
        revokedAt: "2026-04-15T12:01:00.000Z"
      };
    }

    async listBridgeSessions() {
      return [];
    }

    async listRoomSummaries() {
      return [];
    }
  }

  return {
    ApiClient: MockApiClient
  };
});

import { App } from "../App";

describe("App", () => {
  it("renders room shell with room list and message area", async () => {
    render(<App />);

    expect(screen.getByText("房间")).toBeInTheDocument();
    expect(screen.getByText("消息")).toBeInTheDocument();
    expect(await screen.findByText("已接入默认协作空间")).toBeInTheDocument();
  });
});
