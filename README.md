# Twitch Chat Bot

A single-channel Twitch bot that lets the broadcaster and moderators manage custom chat commands
from chat itself, with fixed cooldowns for other viewers. See `specs/001-twitch-chat-bot/` for the
full specification, plan, and design docs.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Register a Twitch application at the [Twitch Developer Console](https://dev.twitch.tv/console)
   and obtain a **broadcaster** user access token scoped `user:read:chat user:write:chat` — used
   both to subscribe to chat messages via EventSub and to send replies. No separate bot account is
   needed; the bot posts using the broadcaster's own account.

3. Copy `.env.example` to `.env` and fill in the client id/secret, the broadcaster token, and the
   channel's broadcaster user ID:

   ```bash
   cp .env.example .env
   ```

4. Create the SQLite schema:

   ```bash
   pnpm run migrate
   ```

5. Start the bot:

   ```bash
   pnpm run build && pnpm start
   ```

   For local development with automatic rebuilds:

   ```bash
   pnpm run dev
   ```

## Managing commands

Once running, the broadcaster or a moderator can manage commands directly from chat — see
`specs/001-twitch-chat-bot/contracts/chat-command-syntax.md` for the full syntax:

```
!addcommand discord https://discord.gg/example
!editcommand discord https://discord.gg/updated
!delcommand discord
```

Any viewer can then invoke a command with `!<trigger>` (e.g. `!discord`), subject to a fixed
10-second global cooldown and 30-second personal cooldown; the broadcaster and moderators are
exempt.

## Validating a full end-to-end flow

See `specs/001-twitch-chat-bot/quickstart.md` for a scripted manual validation walkthrough covering
command management, cooldowns, and restart persistence.

## Tests

```bash
pnpm test
```
