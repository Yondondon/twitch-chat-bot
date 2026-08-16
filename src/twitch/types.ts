/**
 * Normalized shape of a `channel.chat.message` EventSub event, extracted
 * from the raw Twurple payload so the rest of the codebase doesn't depend
 * directly on Twurple's event object shape.
 */
export interface IncomingChatMessage {
  /** Twitch ID of this specific chat message, used to recognize the bot's own replies (FR-016). */
  messageId: string;
  /** Twitch user ID of the chatter who sent the message. */
  chatterUserId: string;
  /** Twitch login/display name of the chatter, for logging and replies. */
  chatterUserName: string;
  /** Raw message text as typed in chat. */
  text: string;
  /** True if the chatter is the channel's broadcaster. */
  isBroadcaster: boolean;
  /** True if the chatter currently holds the moderator badge in this channel. */
  isModerator: boolean;
}
