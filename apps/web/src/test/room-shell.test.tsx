import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../api/client";
import type { RoomSocketClient } from "../api/socket";
import { RoomShell } from "../features/rooms/room-shell";

describe("RoomShell", () => {
  it("subscribes to realtime presence and incoming messages", async () => {
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

    render(<RoomShell apiClient={apiClient} createSocketClient={createSocketClient} />);

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
    expect(await screen.findByText("在线桥接")).toBeInTheDocument();

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
  });
});
