import { describe, expect, it } from "vitest";
import { messageSchema, participantSchema } from "../src";

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
});
