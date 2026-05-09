import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { cleanupTempDir, createTempDir } from "./helpers";

describe("room summary api", () => {
  it("writes room summary snapshots every 2 new messages and lists them back", async () => {
    const tempDir = createTempDir();
    let tick = 0;
    const app = buildServer({
      dataDir: tempDir,
      now: () => new Date(Date.UTC(2026, 3, 15, 14, 0, tick++))
    });

    try {
      for (const message of [
        {
          roomId: "room-1",
          speakerParticipantId: "human-1",
          body: "A"
        },
        {
          roomId: "room-1",
          speakerParticipantId: "agent-1",
          body: "B"
        },
        {
          roomId: "room-1",
          speakerParticipantId: "human-1",
          body: "C"
        },
        {
          roomId: "room-1",
          speakerParticipantId: "agent-1",
          body: "D"
        }
      ]) {
        const created = await app.inject({
          method: "POST",
          url: "/api/messages",
          payload: message
        });

        expect(created.statusCode).toBe(201);
      }

      const response = await app.inject({
        method: "GET",
        url: "/api/room-summaries?roomId=room-1"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toHaveLength(2);
      expect(response.json().items[0]).toEqual(
        expect.objectContaining({
          roomId: "room-1",
          messageCount: 2,
          participantCount: 2,
          summaryText: 'Room room-1 has 2 messages from 2 participants. Latest message: "B"'
        })
      );
      expect(response.json().items[1]).toEqual(
        expect.objectContaining({
          roomId: "room-1",
          messageCount: 4,
          participantCount: 2,
          summaryText: 'Room room-1 has 4 messages from 2 participants. Latest message: "D"'
        })
      );
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
