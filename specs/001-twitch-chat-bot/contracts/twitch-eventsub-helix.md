# Contract: Twitch EventSub / Helix Surface

This documents the external Twitch interfaces the bot depends on — see research.md for the transport/library decisions behind these choices.

## EventSub subscriptions consumed (WebSocket transport)

| Subscription type            | Version | Purpose                                                              |
|-------------------------------|---------|------------------------------------------------------------------------|
| `channel.chat.message`        | 1       | Every chat message in the channel — source for command invocation (FR-006) and management commands (FR-001–003), including chatter badges used for role determination (research.md §4). |

Subscriptions are created via `POST /helix/eventsub/subscriptions` against the WebSocket session obtained from the `session_welcome` message, authenticated with the broadcaster's user access token (subscription creation requires broadcaster-authorized scopes for `channel.chat.message`: `user:read:chat` on the broadcaster's token, per Twitch's chat EventSub requirements).

## Helix endpoints called

| Endpoint                      | Method | Purpose                                                              | Auth                          |
|--------------------------------|--------|------------------------------------------------------------------------|--------------------------------|
| `/helix/eventsub/subscriptions` | POST | Register the `channel.chat.message` subscription against the active WebSocket session on startup/reconnect. | Broadcaster user access token |
| `/helix/chat/messages`        | POST   | Send a command reply or management confirmation into chat, posted as the broadcaster's own account (FR-013). | Broadcaster user access token (`user:write:chat`) |

## Required OAuth scopes

- Broadcaster token: `user:read:chat` (subscribe to chat messages in their channel) and `user:write:chat` (send chat messages as the broadcaster). A single broadcaster-authorized token covers both reading and sending; no separate bot account or `user:bot`/`channel:bot` grant is needed.

Token acquisition/refresh flow (initial authorization, refresh token storage/rotation) is an implementation detail for the tasks phase, not part of this contract — this table only fixes the scopes and endpoints the feature depends on.

**Reply-loop note**: Since outgoing replies are sent from the same account whose incoming messages are subscribed to, the bot MUST recognize and skip processing of its own sent messages (FR-016) to avoid a reply re-triggering command handling.

## Reconnection behavior

- On WebSocket disconnect, the bot MUST re-establish the session and re-register the `channel.chat.message` subscription before resuming processing (spec edge case: bot resumes after reconnect without manual restart — FR-014).
- Twitch-issued `session_reconnect` messages MUST be honored (reconnect to the provided URL) rather than only handling hard disconnects.
- No backfill of messages missed while disconnected — consistent with the spec's assumption that only live events are processed.
