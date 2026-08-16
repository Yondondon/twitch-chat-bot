import { ApiClient } from "@twurple/api";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import { logger } from "../logger.js";
import type { AuthProviders } from "./auth.js";
import type { IncomingChatMessage } from "./types.js";

export type ChatMessageHandler = (message: IncomingChatMessage) => void | Promise<void>;

/**
 * Starts the EventSub WebSocket session and subscribes to
 * `channel.chat.message` for the target channel (research.md §1,
 * contracts/twitch-eventsub-helix.md). Twurple's EventSubWsListener owns
 * session welcome/reconnect/keepalive handling internally, including
 * re-subscribing after a `session_reconnect`, so no manual reconnect logic
 * is needed here (FR-014).
 */
export function startEventSub(
  auth: AuthProviders,
  broadcasterUserId: string,
  onChatMessage: ChatMessageHandler,
): EventSubWsListener {
  const apiClient = new ApiClient({ authProvider: auth.broadcasterAuthProvider });
  const listener = new EventSubWsListener({ apiClient });

  listener.onChannelChatMessage(broadcasterUserId, broadcasterUserId, (event) => {
    void onChatMessage({
      messageId: event.messageId,
      chatterUserId: event.chatterId,
      chatterUserName: event.chatterName,
      text: event.messageText,
      isBroadcaster: event.chatterId === broadcasterUserId,
      isModerator: event.hasBadge("moderator"),
    });
  });
  listener.onSubscriptionCreateFailure((_subscription, error) => {
    logger.error("Failed to create an EventSub subscription", { error: String(error) });
  });

  listener.start();
  logger.info("EventSub WebSocket listener started", { broadcasterUserId });
  return listener;
}
