import type { IncomingChatMessage } from "../twitch/types.js";

export type ChatterRole = "broadcaster" | "moderator" | "other";

/**
 * Determines a chatter's role directly from the badge flags on the
 * triggering message, rather than any cached/previously-fetched role, so a
 * moderator demoted mid-session is immediately reflected (FR-012).
 */
export function getChatterRole(message: IncomingChatMessage): ChatterRole {
  if (message.isBroadcaster) {
    return "broadcaster";
  }
  if (message.isModerator) {
    return "moderator";
  }
  return "other";
}

/** Broadcaster and moderators are exempt from cooldowns and may manage commands (FR-004, FR-007). */
export function isExempt(role: ChatterRole): boolean {
  return role === "broadcaster" || role === "moderator";
}
