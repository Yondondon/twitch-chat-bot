import { describe, expect, it } from "vitest";
import { isReservedTrigger, parseMessage } from "../../src/commands/parser.js";

describe("parseMessage", () => {
  it("returns none for non-command text", () => {
    expect(parseMessage("hello there")).toEqual({ type: "none" });
  });

  it("parses a plain invocation", () => {
    expect(parseMessage("!discord")).toEqual({ type: "invocation", trigger: "discord" });
  });

  it("is case-insensitive and trims whitespace on invocation", () => {
    expect(parseMessage("  !DISCORD  ")).toEqual({ type: "invocation", trigger: "discord" });
  });

  it("parses !addcommand with a leading ! on the trigger", () => {
    expect(parseMessage("!addcommand !discord https://discord.gg/example")).toEqual({
      type: "add",
      trigger: "discord",
      replyText: "https://discord.gg/example",
    });
  });

  it("parses !editcommand with a multi-word reply", () => {
    expect(parseMessage("!editcommand discord Join our Discord: https://discord.gg/example")).toEqual({
      type: "edit",
      trigger: "discord",
      replyText: "Join our Discord: https://discord.gg/example",
    });
  });

  it("parses !delcommand", () => {
    expect(parseMessage("!delcommand discord")).toEqual({ type: "delete", trigger: "discord" });
  });

  it("returns none for !addcommand missing reply text", () => {
    expect(parseMessage("!addcommand discord")).toEqual({ type: "none" });
  });

  it("returns none for bare !", () => {
    expect(parseMessage("!")).toEqual({ type: "none" });
  });
});

describe("isReservedTrigger", () => {
  it("flags the management keywords as reserved", () => {
    expect(isReservedTrigger("addcommand")).toBe(true);
    expect(isReservedTrigger("editcommand")).toBe(true);
    expect(isReservedTrigger("delcommand")).toBe(true);
  });

  it("does not flag an ordinary trigger", () => {
    expect(isReservedTrigger("discord")).toBe(false);
  });
});
