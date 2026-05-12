import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
