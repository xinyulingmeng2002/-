import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MessageComposer } from "../features/chat/message-composer";

describe("MessageComposer", () => {
  it("submits text messages with an explicit speaker identity", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(<MessageComposer speakerParticipantId="human-1" onSend={onSend} />);

    await user.type(screen.getByRole("textbox"), "先把事件日志打通");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        speakerParticipantId: "human-1",
        body: "先把事件日志打通"
      })
    );
  });

  it("lets the human address an agent by inserting a visible mention", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageComposer
        speakerParticipantId="human-1"
        onSend={onSend}
        mentionTargets={[
          {
            id: "agent-codex",
            displayName: "Codex"
          }
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: "对 Codex 说" }));
    await user.type(screen.getByRole("textbox"), "你怎么看这个方案？");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        speakerParticipantId: "human-1",
        body: "@Codex 你怎么看这个方案？",
        mentions: [
          {
            participantId: "agent-codex",
            displayName: "Codex"
          }
        ]
      })
    );
  });

  it("applies a reply draft before sending a public follow-up", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageComposer
        speakerParticipantId="human-1"
        onSend={onSend}
        draft={{
          id: "reply-msg-1",
          body: "> 回复 agent-realtime: 来自实时链路\n\n",
          replyToMessageId: "msg-1"
        }}
      />
    );

    expect(screen.getByRole("textbox")).toHaveValue("> 回复 agent-realtime: 来自实时链路\n\n");

    await user.type(screen.getByRole("textbox"), "我接着这个点说。");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        speakerParticipantId: "human-1",
        body: "> 回复 agent-realtime: 来自实时链路\n\n我接着这个点说。",
        replyToMessageId: "msg-1"
      })
    );
  });
});
