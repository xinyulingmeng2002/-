import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MessageList } from "../features/chat/message-list";

describe("MessageList", () => {
  it("highlights visible agent mentions in timeline messages", () => {
    render(
      <MessageList
        messages={[
          {
            id: "msg-1",
            kind: "chat",
            body: "@Codex 你怎么看这个方向？",
            speakerParticipantId: "human-1",
            timestamp: "2026-05-12T00:00:00.000Z"
          }
        ]}
      />
    );

    expect(screen.getByText("@Codex")).toHaveClass("message-mention");
    expect(screen.getByText("你怎么看这个方向？")).toBeInTheDocument();
  });

  it("lets the room owner start a public reply from a timeline message", async () => {
    const onReply = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageList
        messages={[
          {
            id: "msg-1",
            kind: "chat",
            body: "来自实时链路",
            speakerParticipantId: "agent-realtime",
            timestamp: "2026-05-12T00:00:00.000Z"
          }
        ]}
        onReply={onReply}
      />
    );

    await user.click(screen.getByRole("button", { name: "回复 Agent realtime 的消息" }));

    expect(onReply).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "msg-1",
        body: "来自实时链路",
        speakerParticipantId: "agent-realtime"
      })
    );
  });

  it("renders public reply references as a visual quote block", () => {
    render(
      <MessageList
        messages={[
          {
            id: "msg-reply-1",
            kind: "chat",
            body: "> 回复 agent-codex-main: 我刚才的观点\n\n@Codex 我接着这个点说。",
            speakerParticipantId: "human-1",
            timestamp: "2026-05-12T00:00:00.000Z"
          }
        ]}
      />
    );

    expect(screen.getByText("回复 agent-codex-main: 我刚才的观点")).toHaveClass("message-quote");
    expect(screen.getByText("@Codex")).toHaveClass("message-mention");
    expect(screen.getByText(/我接着这个点说。/)).toBeInTheDocument();
  });
});
