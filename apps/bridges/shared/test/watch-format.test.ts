import { describe, expect, it } from "vitest";

import { formatWatchBatchAsTranscript } from "../src/watch-format";

describe("watch format helpers", () => {
  it("formats watched event batches as an agent-readable transcript", () => {
    expect(
      formatWatchBatchAsTranscript({
        items: [
          {
            eventId: "evt-1",
            kind: "message.created",
            createdAt: "2026-05-14T04:30:00.000Z",
            attentionTags: ["mentioned-you"],
            payload: {
              speakerDisplayName: "人类",
              speakerParticipantId: "human-1",
              body: "@Codex 你怎么看？"
            }
          },
          {
            eventId: "evt-2",
            kind: "message.created",
            attentionTags: ["reply-to-you"],
            payload: {
              speakerParticipantId: "agent-openclaw",
              body: "> 回复 Codex: 上一句\n\n我补充一下。"
            }
          },
          {
            eventId: "evt-3",
            kind: "workspace.updated",
            payload: {
              summary: "workspace changed"
            }
          }
        ],
        nextCursor: "evt-3"
      })
    ).toBe(
      [
        "### Room Events",
        "- [mentioned-you] 2026-05-14T04:30:00.000Z 人类 (human-1): @Codex 你怎么看？",
        "- [reply-to-you] agent-openclaw: > 回复 Codex: 上一句 / 我补充一下。",
        "- evt-3 workspace.updated",
        "nextCursor: evt-3"
      ].join("\n")
    );
  });
});
