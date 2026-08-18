# Backend REST API Contract

Base path: `/api`. JSON request/response bodies. Session identified via
httpOnly cookie (research.md §3) — no `Authorization` header from the UI.

## Commands

### `GET /api/commands`

Public, no auth required.

**200**:
```json
{
  "commands": [
    { "id": 1, "trigger": "discord", "replyText": "Join us: ...", "updatedAt": "2026-08-18T12:00:00.000Z" }
  ]
}
```

### `POST /api/commands`

Requires session with role `broadcaster` or `moderator` (FR-004).

**Body**: `{ "trigger": "discord", "replyText": "Join us: ..." }`

**201**: `{ "command": { "id": 2, "trigger": "discord", "replyText": "...", "updatedAt": "..." } }`

**Errors**:
- `401` — not signed in
- `403` — signed in but not broadcaster/moderator (FR-007)
- `400 { "error": "validation", "field": "trigger" | "replyText" }` — empty after trim (FR-009)
- `409 { "error": "duplicate_trigger" }` — case-insensitive collision (FR-008)

### `PATCH /api/commands/:id`

Requires session with role `broadcaster` or `moderator` (FR-005).

**Body**: `{ "trigger"?: "newtrigger", "replyText"?: "new reply" }` — at least one field; trigger rename supported directly (data-model.md, research.md §5).

**200**: `{ "command": { ...updated } }`

**Errors**: same shape as `POST`, plus `404 { "error": "not_found" }` if `:id` doesn't exist.

### `DELETE /api/commands/:id`

Requires session with role `broadcaster` or `moderator` (FR-006).

**204** on success. **401/403** as above. **404** if `:id` doesn't exist.

## Auth

### `GET /api/auth/login`

Redirects (302) to Twitch's OAuth authorize URL. No auth required.

### `GET /api/auth/callback`

Twitch redirects here with `code`. Backend exchanges the code, fetches the
user's Twitch id/login, sets the session cookie, then redirects (302) to
`UI_ORIGIN`. On failure, redirects to `UI_ORIGIN` with an error indicator
(e.g. `?auth_error=1`) rather than rendering a bare error page.

### `GET /api/auth/me`

**200** (always 200, never 401 — this endpoint describes the caller, it doesn't gate anything):
```json
{ "authenticated": false, "user": null, "role": "anonymous" }
```
or
```json
{ "authenticated": true, "user": { "id": "123", "login": "somestreamer" }, "role": "broadcaster" }
```

### `POST /api/auth/logout`

Clears the session cookie. **204**.

## Cross-cutting

- CORS: only `UI_ORIGIN` allowed, `credentials: true`.
- All mutating endpoints re-derive role live from Twitch (research.md §4); the
  session cookie only proves *identity*, never authorization by itself.
- Rate/duplicate handling mirrors the chat path's `CommandService` exactly
  (same module reused — see plan.md's `backend/src/commands/service.ts`).
