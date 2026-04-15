import { io, type Socket } from "socket.io-client";
import { describe, expect, it } from "vitest";

import { startTestServer } from "./helpers";

interface PresencePayload {
  roomId: string;
  participant: {
    id: string;
    type: string;
    displayName: string;
  };
}

function waitForConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", (error) => reject(error));
    socket.connect();
  });
}

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 800): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    function onEvent(payload: T) {
      clearTimeout(timer);
      resolve(payload);
    }

    socket.once(event, onEvent);
  });
}

function expectNoEvent(socket: Socket, event: string, timeoutMs = 250): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve();
    }, timeoutMs);

    function onEvent(payload: unknown) {
      clearTimeout(timer);
      reject(new Error(`Unexpected ${event}: ${JSON.stringify(payload)}`));
    }

    socket.once(event, onEvent);
  });
}

describe("socket room presence", () => {
  it("broadcasts participant join to the room only", async () => {
    const { close, url } = await startTestServer();
    const a = io(url, { autoConnect: false, transports: ["websocket"] });
    const b = io(url, { autoConnect: false, transports: ["websocket"] });
    const outsider = io(url, { autoConnect: false, transports: ["websocket"] });

    try {
      await Promise.all([waitForConnect(a), waitForConnect(b), waitForConnect(outsider)]);

      const codex: PresencePayload = {
        roomId: "room-1",
        participant: {
          id: "agent-codex",
          type: "agent",
          displayName: "Codex"
        }
      };

      a.emit("room:join", codex);

      const presencePromise = waitForEvent<PresencePayload>(a, "room:presence");
      const noPresencePromise = expectNoEvent(outsider, "room:presence");
      b.emit("room:join", codex);

      await expect(presencePromise).resolves.toEqual(codex);
      await expect(noPresencePromise).resolves.toBeUndefined();
    } finally {
      a.disconnect();
      b.disconnect();
      outsider.disconnect();
      await close();
    }
  });

  it("broadcasts standalone room:presence updates only to room members", async () => {
    const { close, url } = await startTestServer();
    const a = io(url, { autoConnect: false, transports: ["websocket"] });
    const b = io(url, { autoConnect: false, transports: ["websocket"] });
    const outsider = io(url, { autoConnect: false, transports: ["websocket"] });

    try {
      await Promise.all([waitForConnect(a), waitForConnect(b), waitForConnect(outsider)]);

      const joined: PresencePayload = {
        roomId: "room-1",
        participant: {
          id: "agent-codex",
          type: "agent",
          displayName: "Codex"
        }
      };

      a.emit("room:join", joined);
      b.emit("room:join", joined);
      await waitForEvent<PresencePayload>(a, "room:presence");

      const updated: PresencePayload = {
        roomId: "room-1",
        participant: {
          id: "agent-codex",
          type: "agent",
          displayName: "Codex Updated"
        }
      };

      const roomPresencePromise = waitForEvent<PresencePayload>(a, "room:presence");
      const outsiderNoPresencePromise = expectNoEvent(outsider, "room:presence");
      b.emit("room:presence", updated);

      await expect(roomPresencePromise).resolves.toEqual(updated);
      await expect(outsiderNoPresencePromise).resolves.toBeUndefined();
    } finally {
      a.disconnect();
      b.disconnect();
      outsider.disconnect();
      await close();
    }
  });
});
