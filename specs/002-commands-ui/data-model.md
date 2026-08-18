# Phase 1 Data Model: Commands Management UI

No schema changes. This feature reuses the `commands` table and
`CommandRepository` introduced in the prior chat-commands feature
(`backend/src/storage/migrations/001_init.sql`), read and written through the
same repository by both the chat path and the new HTTP API.

## Command (existing, unchanged)

| Field | Type | Notes |
|---|---|---|
| `id` | integer, PK | |
| `trigger` | text | Case-insensitively unique (`idx_commands_trigger_lower`); UI edit may change this field directly (research.md §5) |
| `replyText` | text | |
| `createdBy` | text | Twitch user id of original creator; UI-created commands populate this from the signed-in session's user id |
| `createdAt` / `updatedAt` | text (ISO) | `updatedAt` bumped on any UI or chat edit |
| `globalLastUsedAt` | text (ISO) \| null | Unrelated to this feature (cooldown tracking) |

**Validation rules (enforced in `CommandService`, reused by both chat and HTTP paths)**:
- Trigger and reply text must be non-empty after trimming (FR-009).
- Trigger must not match a reserved management keyword (`addcommand`, `editcommand`, `delcommand`).
- Trigger must not case-insensitively collide with a *different* existing command, on both create and edit-with-rename (FR-008).

## Dashboard User (runtime concept, not persisted)

Represents the caller of a request; never stored — derived per-request from
the session cookie plus a live Twitch role lookup (research.md §4).

| Field | Type | Source |
|---|---|---|
| `twitchUserId` | string \| null | Session cookie (JWT `sub`), null if not signed in |
| `login` / `displayName` | string \| null | Session cookie, populated at login from Twitch's `/users` response |
| `role` | `"broadcaster" \| "moderator" \| "other" \| "anonymous"` | Computed fresh per request: `anonymous` if no session; otherwise `broadcaster`/`moderator`/`other` via live Helix check (never cached, never trusted from the cookie) |

`role` is exposed to the UI via `GET /api/auth/me` so the dashboard can
show/hide management controls, but the backend independently re-derives it on
every mutating request — the UI's copy is for rendering only, never trusted
for authorization (enforced server-side regardless of what the client sends).

## State transitions

Unchanged from the prior feature: a command is created, optionally edited any
number of times (reply text and/or, new in this feature, trigger), and
deleted. No new states or lifecycle introduced.
