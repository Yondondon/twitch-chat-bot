# Quickstart: Commands Management UI

## Prerequisites

- Node.js >=24, pnpm
- Existing `.env` values (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`,
  `BROADCASTER_USER_ID`, `BROADCASTER_ACCESS_TOKEN`,
  `BROADCASTER_REFRESH_TOKEN`, `DATABASE_PATH`), plus new ones from
  research.md §3: `TWITCH_REDIRECT_URI` (e.g.
  `http://localhost:8787/api/auth/callback`), `SESSION_SECRET`, `UI_ORIGIN`
  (e.g. `http://localhost:5173`), `HTTP_PORT` (e.g. `8787`)
- A Twitch Developer Console app with the redirect URI above registered

## Setup

```bash
pnpm install                 # installs both backend/ and ui/ workspaces
pnpm --filter backend run migrate   # ensures commands table exists
```

## Run (two processes, one command)

```bash
pnpm dev   # root script: runs backend HTTP API + UI dev server together
```

- UI: http://localhost:5173
- Backend API: http://localhost:8787/api (proxied from the UI dev server at `/api`)

The chat/EventSub bot process (`backend/src/index.ts`) is unchanged and run
separately (`pnpm --filter backend run start` after build, or its own dev
script) — it is not required for the dashboard's read path to work, but
management actions (chat or UI) only make sense with it running against the
same `DATABASE_PATH`.

## Validate User Story 1 (manage via UI)

1. Open http://localhost:5173/commands — confirm the list loads (empty or
   existing commands), with no add/edit/delete controls visible while
   signed out.
2. Click "Sign in with Twitch" (header), complete OAuth as the broadcaster
   account.
3. Back on `/commands`, confirm Add/Edit/Delete controls now appear.
4. Add a command (`!discord` → some reply text); confirm it appears in the
   list, and confirm in chat that `!discord` now responds.
5. Edit its reply text (and separately, its trigger) via the dialog; confirm
   the list updates and chat reflects the new reply/trigger.
6. Attempt to add a command with a trigger that already exists (any case);
   confirm a rejection message and no duplicate created (FR-008, see
   contracts/api.md's `409`).
7. Remove the command; confirm it disappears from the list and chat stops
   responding to it.

## Validate User Story 2 (anonymous read-only)

1. Sign out (or use a private browser window).
2. Open `/commands`; confirm the full list is visible with no sign-in prompt
   blocking it, and no management controls present (contracts/ui.md).

## Validate User Story 3 (chat management still works, reflected in UI)

1. With the UI open, add a command via chat (`!addcommand !foo bar`) as the
   broadcaster.
2. Reload `/commands` in the UI; confirm `!foo` appears.
3. Edit and remove it via chat; reload the UI after each and confirm it
   reflects the change (SC-005).

## Automated checks

```bash
pnpm --filter backend run test   # existing + new HTTP route tests
pnpm --filter backend run lint
pnpm --filter ui run test          # new component/route tests
pnpm --filter ui run lint
```
