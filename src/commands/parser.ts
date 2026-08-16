export const RESERVED_TRIGGERS = ["addcommand", "editcommand", "delcommand"] as const;

export type ParsedMessage =
  | { type: "invocation"; trigger: string }
  | { type: "add"; trigger: string; replyText: string }
  | { type: "edit"; trigger: string; replyText: string }
  | { type: "delete"; trigger: string }
  | { type: "none" };

/**
 * Parses raw chat text into either a command invocation (`!<trigger>`) or a
 * management action (`!addcommand`/`!editcommand`/`!delcommand`), per
 * contracts/chat-command-syntax.md. Returns `{ type: "none" }` for anything
 * that isn't `!`-prefixed at all (ordinary chat).
 */
export function parseMessage(text: string): ParsedMessage {
  const trimmed = text.trim();
  if (!trimmed.startsWith("!")) {
    return { type: "none" };
  }

  const withoutBang = trimmed.slice(1);
  const firstSpace = withoutBang.indexOf(" ");
  const firstWord = (firstSpace === -1 ? withoutBang : withoutBang.slice(0, firstSpace)).toLowerCase();
  const rest = firstSpace === -1 ? "" : withoutBang.slice(firstSpace + 1).trim();

  if (firstWord === "addcommand" || firstWord === "editcommand") {
    const [triggerRaw, ...replyParts] = rest.split(" ");
    const trigger = normalizeTrigger(triggerRaw ?? "");
    const replyText = replyParts.join(" ").trim();
    if (!trigger || !replyText) {
      return { type: "none" };
    }
    return { type: firstWord === "addcommand" ? "add" : "edit", trigger, replyText };
  }

  if (firstWord === "delcommand") {
    const trigger = normalizeTrigger(rest.split(" ")[0] ?? "");
    if (!trigger) {
      return { type: "none" };
    }
    return { type: "delete", trigger };
  }

  if (!firstWord) {
    return { type: "none" };
  }

  return { type: "invocation", trigger: firstWord };
}

/** Strips a leading `!` if the caller included one when naming a trigger, and lowercases it. */
function normalizeTrigger(raw: string): string {
  return (raw.startsWith("!") ? raw.slice(1) : raw).toLowerCase();
}

export function isReservedTrigger(trigger: string): boolean {
  return (RESERVED_TRIGGERS as readonly string[]).includes(trigger.toLowerCase());
}
