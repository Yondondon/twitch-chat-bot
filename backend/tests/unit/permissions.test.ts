import { describe, expect, it } from "vitest";
import { getChatterRole, isExempt } from "../../src/commands/permissions.js";
import type { IncomingChatMessage } from "../../src/twitch/types.js";

function message(overrides: Partial<IncomingChatMessage>): IncomingChatMessage {
  return {
    messageId: "msg-1",
    chatterUserId: "123",
    chatterUserName: "viewer",
    text: "!discord",
    isBroadcaster: false,
    isModerator: false,
    ...overrides,
  };
}

describe("getChatterRole", () => {
  it("returns broadcaster when isBroadcaster is true", () => {
    expect(getChatterRole(message({ isBroadcaster: true }))).toBe("broadcaster");
  });

  it("returns moderator when isModerator is true and not broadcaster", () => {
    expect(getChatterRole(message({ isModerator: true }))).toBe("moderator");
  });

  it("returns other for a plain viewer", () => {
    expect(getChatterRole(message({}))).toBe("other");
  });

  it("prefers broadcaster over moderator when both flags are set", () => {
    expect(getChatterRole(message({ isBroadcaster: true, isModerator: true }))).toBe("broadcaster");
  });
});

describe("isExempt", () => {
  it("exempts broadcaster and moderator", () => {
    expect(isExempt("broadcaster")).toBe(true);
    expect(isExempt("moderator")).toBe(true);
  });

  it("does not exempt other", () => {
    expect(isExempt("other")).toBe(false);
  });
});
