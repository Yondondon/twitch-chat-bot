# Twitch Chat Bot

A single-channel Twitch bot that lets the broadcaster and moderators manage custom chat commands
from chat or from a web dashboard, with fixed cooldowns for other viewers. See
`specs/001-twitch-chat-bot/` and `specs/002-commands-ui/` for the full specifications, plans, and
design docs.

## Monorepo layout

This is a pnpm workspace with two packages:

- **`backend/`** — the chat bot (EventSub + chat replies) and the dashboard's HTTP API. Two
  separate Node processes share the same SQLite database and `CommandRepository`:
  - `src/index.ts` — the chat bot process
  - `src/server-entry.ts` — the HTTP API process (Fastify)
- **`ui/`** — the React + Vite dashboard (TanStack Router/Query, shadcn/ui, Tailwind, dark-only).

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Register a Twitch application at the [Twitch Developer Console](https://dev.twitch.tv/console).
   You'll need:
   - A **redirect URI** matching `TWITCH_REDIRECT_URI` below (e.g.
     `http://localhost:8787/api/auth/callback`), for dashboard sign-in.
   - A **broadcaster** user access token scoped
     `user:read:chat user:write:chat moderation:read` — used to subscribe to chat messages via
     EventSub, send replies, and (for the dashboard) check whether a signed-in visitor is a
     moderator. No separate bot account is needed; the bot posts using the broadcaster's own
     account.

3. Copy `backend/.env.example` to `backend/.env` and fill in the client id/secret, the broadcaster
   token, the channel's broadcaster user ID, and the dashboard settings (`TWITCH_REDIRECT_URI`,
   `SESSION_SECRET` — e.g. `openssl rand -hex 32`, `UI_ORIGIN`, `HTTP_PORT`):

   ```bash
   cp backend/.env.example backend/.env
   ```

4. Create the SQLite schema:

   ```bash
   pnpm --filter backend run migrate
   ```

5. Run both the dashboard's HTTP API and the UI dev server together:

   ```bash
   pnpm dev
   ```

   The UI is served at `http://localhost:5173` (proxying `/api/*` to the backend). The chat bot
   process is separate and run on its own:

   ```bash
   pnpm --filter backend run build && pnpm --filter backend run start
   ```

   For local development with automatic rebuilds of the chat bot:

   ```bash
   pnpm --filter backend run dev
   ```

## Managing commands

Once running, the broadcaster or a moderator can manage commands either from the dashboard at
`/commands` (after signing in with Twitch) or directly from chat — see
`specs/001-twitch-chat-bot/contracts/chat-command-syntax.md` for the full chat syntax:

```
!addcommand discord https://discord.gg/example
!editcommand discord https://discord.gg/updated
!delcommand discord
```

Any viewer can then invoke a command with `!<trigger>` (e.g. `!discord`), subject to a fixed
10-second global cooldown and 30-second personal cooldown; the broadcaster and moderators are
exempt. Both management paths operate on the same underlying data, so a change made through one is
immediately visible through the other.

## Validating a full end-to-end flow

See `specs/001-twitch-chat-bot/quickstart.md` and `specs/002-commands-ui/quickstart.md` for
scripted manual validation walkthroughs.

## Tests

```bash
pnpm test    # runs both packages; use pnpm --filter backend/ui run test for just one
```
