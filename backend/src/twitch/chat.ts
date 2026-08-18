import { ApiClient } from "@twurple/api";
import type { AuthProviders } from "./auth.js";

export interface ChatSender {
  /**
   * Sends `text` into the channel's chat as the broadcaster's own account.
   * Resolves with the sent message's ID, so callers can recognize it if it
   * comes back through EventSub (FR-016).
   */
  send(text: string): Promise<string>;
}

/**
 * Builds a ChatSender that posts via the Helix "Send Chat Message" endpoint
 * (contracts/twitch-eventsub-helix.md), authenticated as the broadcaster's
 * own account (FR-013) — the same account used to read chat.
 */
export function createChatSender(auth: AuthProviders, broadcasterUserId: string): ChatSender {
  const apiClient = new ApiClient({ authProvider: auth.broadcasterAuthProvider });

  return {
    async send(text: string): Promise<string> {
      const sent = await apiClient.chat.sendChatMessage(broadcasterUserId, text);
      return sent.id;
    },
  };
}
