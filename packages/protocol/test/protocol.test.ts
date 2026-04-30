import { describe, expect, it } from "vitest";
import { attachmentSchema, messageSchema, participantSchema } from "../src";

describe("protocol schemas", () => {
  it("rejects participants without a concrete type", () => {
    expect(() =>
      participantSchema.parse({ id: "p1", displayName: "Participant 1" }),
    ).toThrow();
  });

  it("requires speaker identity on user-facing messages", () => {
    expect(() =>
      messageSchema.parse({ id: "m1", kind: "chat", roomId: "r1", body: "hi" }),
    ).toThrow();
  });

  it("rejects unknown keys in protocol objects", () => {
    expect(() =>
      participantSchema.parse({
        id: "p1",
        type: "human",
        displayName: "Participant 1",
        extra: "nope"
      }),
    ).toThrow();

    expect(() =>
      messageSchema.parse({
        id: "m1",
        roomId: "r1",
        kind: "chat",
        speakerParticipantId: "p1",
        body: "hi",
        extra: true
      }),
    ).toThrow();
  });

  it("requires display metadata on attachments", () => {
    expect(() =>
      attachmentSchema.parse({
        id: "att-1",
        messageId: "",
        kind: "image",
        url: "https://example.com/file.png"
      })
    ).toThrow();
  });
});
