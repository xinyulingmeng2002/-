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
        body: "@Codex 你怎么看这个方案？"
      })
    );
  });
});
