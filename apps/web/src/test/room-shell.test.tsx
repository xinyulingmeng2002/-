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
      uploadFile: vi.fn()
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

    expect(await screen.findByText("实时助手")).toBeInTheDocument();

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
  });
});
