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
});
