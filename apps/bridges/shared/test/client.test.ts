import { describe, expect, it, vi } from "vitest";

import { createBridgeClient } from "../src/client";

describe("bridge client", () => {
  it("builds authenticated bridge requests from token config", () => {
    const client = createBridgeClient({
      baseUrl: "http://127.0.0.1:3000",
      token: "secret"
    });

    expect(client.headers()).toEqual({
      authorization: "Bearer secret"
    });
  });

  it("sends connect, heartbeat, disconnect, join-room, and message requests to bridge ingress endpoints", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: { id: "session-1" } }), {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "session-1", status: "connected" }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "session-1", status: "disconnected" }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "session-1", activeRoomIds: ["room-1"] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ kind: "message.created", roomId: "room-1" }), {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ eventId: "evt-2", kind: "message.created", roomId: "room-1" }],
            nextCursor: "evt-2"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );

    const client = createBridgeClient({
      baseUrl: "http://127.0.0.1:3000/",
      token: "secret",
      fetch: fetchMock
    });

    const connected = await client.connect({
      agentId: "agent-codex",
      displayName: "Codex",
      capabilities: ["chat", "code"]
    });
    const heartbeat = await client.heartbeat({
      sessionId: "session-1",
      agentId: "agent-codex"
    });
    const disconnected = await client.disconnect({
      sessionId: "session-1",
      agentId: "agent-codex"
    });
    const joined = await client.joinRoom({
      sessionId: "session-1",
      agentId: "agent-codex",
      roomId: "room-1"
    });
    const sent = await client.sendMessage({
      sessionId: "session-1",
      agentId: "agent-codex",
      roomId: "room-1",
      body: "Bridge ingress message"
    });
    const pulled = await client.pullEvents({
      sessionId: "session-1",
      agentId: "agent-codex",
      roomId: "room-1",
      afterEventId: "evt-1",
      limit: 20
    });

    expect(connected).toEqual({ session: { id: "session-1" } });
    expect(heartbeat).toEqual({ id: "session-1", status: "connected" });
    expect(disconnected).toEqual({ id: "session-1", status: "disconnected" });
    expect(joined).toEqual({ id: "session-1", activeRoomIds: ["room-1"] });
    expect(sent).toEqual({ kind: "message.created", roomId: "room-1" });
    expect(pulled).toEqual({
      items: [{ eventId: "evt-2", kind: "message.created", roomId: "room-1" }],
      nextCursor: "evt-2"
    });

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:3000/api/bridge/ingress/connect",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          agentId: "agent-codex",
          displayName: "Codex",
          capabilities: ["chat", "code"]
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3000/api/bridge/ingress/heartbeat",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "session-1",
          agentId: "agent-codex"
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:3000/api/bridge/ingress/disconnect",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "session-1",
          agentId: "agent-codex"
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:3000/api/bridge/ingress/join-room",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "session-1",
          agentId: "agent-codex",
          roomId: "room-1"
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://127.0.0.1:3000/api/bridge/ingress/message",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sessionId: "session-1",
          agentId: "agent-codex",
          roomId: "room-1",
          body: "Bridge ingress message"
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://127.0.0.1:3000/api/bridge/egress/events?agentId=agent-codex&sessionId=session-1&roomId=room-1&afterEventId=evt-1&limit=20",
      expect.objectContaining({
        method: "GET",
        headers: {
          authorization: "Bearer secret"
        }
      })
    );
  });
});
