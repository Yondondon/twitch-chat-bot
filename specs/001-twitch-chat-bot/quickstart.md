# Quickstart: Validating the Twitch Chat Bot

This is a runnable validation guide, not implementation documentation. It proves the feature works end-to-end against the acceptance scenarios in `spec.md`. See `data-model.md` for schema details and `contracts/` for the exact interfaces exercised below.

## Prerequisites

- Node.js 24 installed (required for the built-in `node:sqlite` module — see research.md §5).
- One Twitch account: the broadcaster/streamer's own account, used both to read chat and to send replies (per FR-013 / research.md §3) — no separate bot account is needed.
- Twitch application credentials (client ID/secret) registered at the Twitch Developer Console, with a broadcaster user access token scoped `user:read:chat user:write:chat`.
- A test/staging Twitch channel (recommended over the live production channel) where you have broadcaster and moderator test accounts available.

## Setup

```bash
pnpm install
cp .env.example .env   # fill in client id/secret, broadcaster token, channel id
pnpm run migrate        # builds the project and creates the SQLite schema (commands, command_user_cooldowns)
pnpm start               # connects EventSub WebSocket, subscribes to channel.chat.message
```

Expected: process logs a successful WebSocket session welcome and a confirmed `channel.chat.message` subscription for the target channel.

## Scenario 1 — Manage commands from chat (User Story 1)

1. As the broadcaster (or a mod account), send in chat: `!addcommand discord https://discord.gg/example`
   - Expect: bot replies confirming the command was added.
2. As any viewer account, send: `!discord`
   - Expect: bot replies with `https://discord.gg/example`.
3. As a mod, send: `!editcommand discord https://discord.gg/updated`
   - Expect: bot replies confirming the update.
4. As any viewer, send: `!discord` again.
   - Expect: bot replies with the updated URL.
5. As a mod, send: `!delcommand discord`
   - Expect: bot confirms removal.
6. As any viewer, send: `!discord` again.
   - Expect: no bot reply.
7. As a non-mod viewer, attempt: `!addcommand test hello`
   - Expect: no bot reply, and `!test` still does not exist for anyone.
8. Reply-loop check (FR-016): confirm each bot reply above appeared exactly once in chat, with no repeated/duplicated follow-up replies — since the bot now posts from the broadcaster's own account, its own messages must not be reprocessed as new commands.

## Scenario 2 — Cooldowns (User Story 2)

Re-add a command first: `!addcommand ping pong!` (as broadcaster/mod).

1. As viewer A, send `!ping` — expect a reply.
2. Immediately, as viewer A again, send `!ping` — expect no reply (30s personal cooldown, FR-008).
3. Immediately, as viewer B, send `!ping` — expect no reply (10s global cooldown, FR-009), even though viewer B has never triggered it before.
4. Wait 11+ seconds, as viewer B, send `!ping` — expect a reply now (global cooldown elapsed) as long as B's own personal cooldown isn't active.
5. As the broadcaster or a mod, send `!ping` repeatedly (3+ times back to back) — expect a reply every single time, no cooldown applied (FR-007).

## Scenario 3 — Persistence across restart (SC-005 / FR-015)

1. With the `ping` command still present from Scenario 2, stop the bot process (`Ctrl+C`).
2. Restart it (`pnpm start`).
3. As any viewer, send `!ping` — expect a reply using the same stored text, confirming the command survived the restart without recreation.

## Cleanup

Remove any test commands created above (`!delcommand ping`, etc.) if this was run against a shared staging channel.
