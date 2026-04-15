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

const describeSocket = process.env.RUN_SOCKET_IT === "1" ? describe : describe.skip;

function waitForConnect(socket: Socket, timeoutMs = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      reject(new Error("Timed out waiting for socket connect"));
    }, timeoutMs);

    function onConnect() {
      clearTimeout(timer);
      socket.off("connect_error", onConnectError);
      resolve();
    }

    function onConnectError(error: Error) {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      reject(error);
    }

    socket.once("connect", onConnect);
    socket.once("connect_error", onConnectError);
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

async function joinRoomBarrier(socket: Socket, payload: PresencePayload): Promise<void> {
  const presencePromise = waitForEvent<PresencePayload>(socket, "room:presence");
  socket.emit("room:join", payload);
  await expect(presencePromise).resolves.toEqual(payload);
}

describeSocket("socket room presence", () => {
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

      await joinRoomBarrier(a, codex);

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

      await joinRoomBarrier(a, joined);
      await joinRoomBarrier(b, joined);

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

  it("ignores room:presence and room:message:new from sockets outside the room", async () => {
    const { close, url } = await startTestServer();
    const member = io(url, { autoConnect: false, transports: ["websocket"] });
    const outsider = io(url, { autoConnect: false, transports: ["websocket"] });

    try {
      await Promise.all([waitForConnect(member), waitForConnect(outsider)]);

      const joined: PresencePayload = {
        roomId: "room-1",
        participant: {
          id: "agent-codex",
          type: "agent",
          displayName: "Codex"
        }
      };
      await joinRoomBarrier(member, joined);

      const outsiderPresence: PresencePayload = {
        roomId: "room-1",
        participant: {
          id: "user-outsider",
          type: "user",
          displayName: "Outsider"
        }
      };

      const noPresenceForMember = expectNoEvent(member, "room:presence");
      const noMessageForMember = expectNoEvent(member, "room:message:new");
      outsider.emit("room:presence", outsiderPresence);
      outsider.emit("room:message:new", { ...outsiderPresence, message: { text: "hi" } });

      await expect(noPresenceForMember).resolves.toBeUndefined();
      await expect(noMessageForMember).resolves.toBeUndefined();
    } finally {
      member.disconnect();
      outsider.disconnect();
      await close();
    }
  });
});
