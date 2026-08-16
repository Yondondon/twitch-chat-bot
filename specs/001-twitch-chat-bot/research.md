# Research: Twitch Chat Bot

## 1. EventSub transport

**Decision**: EventSub over WebSocket (`wss://eventsub.wss.twitch.tv/ws`), not webhooks.

**Rationale**: The bot is a single-process, single-channel deployment with no requirement for a publicly reachable HTTPS endpoint. The WebSocket transport lets the process establish an outbound connection, receive a `session_welcome` message with a session ID, and register subscriptions (`channel.chat.message`, `channel.chat.notification`) against that session via the Helix API — no inbound webhook server, TLS cert, or public domain needed. This matches the "simple local/single-process deployment" constraint from the brief.

**Alternatives considered**:
- *Webhook transport*: Requires a public HTTPS endpoint (reverse proxy, TLS, signature verification middleware). Rejected — unnecessary operational overhead for a single-instance bot.
- *Raw IRC*: Explicitly excluded by the brief in favor of EventSub + Helix.

## 2. Twitch API client library

**Decision**: Use `@twurple/auth`, `@twurple/api`, and `@twurple/eventsub-ws` (the Twurple suite).

**Rationale**: Twurple is a mature, actively maintained TypeScript library for the Twitch Helix API and EventSub, with first-class WebSocket EventSub support and built-in OAuth token refresh handling. Using it avoids hand-rolling token refresh, request signing, and EventSub session/keepalive/reconnect handling, which are all non-trivial to get right.

**Alternatives considered**:
- *Raw `fetch` + hand-written WebSocket client*: More control, but reimplements token refresh and EventSub reconnect/resubscribe logic that Twurple already provides. Rejected for a small single-channel bot — not worth the maintenance burden.

## 3. Sending chat messages as the bot

**Decision**: Use the Helix "Send Chat Message" API (`POST /helix/chat/messages`) authenticated as the broadcaster's own Twitch account, with the broadcaster's user access token carrying the `user:write:chat` scope. No separate/dedicated bot account is registered or used.

**Rationale**: This is the current (IRC-free) Twitch-recommended way to send chat messages, matching the brief's updated requirement to post as the broadcaster rather than a separate bot identity. Because the broadcaster is posting to their own channel, the `user:bot`/`channel:bot` scopes and grant flow needed for a third-party bot identity are not required.

**Alternatives considered**:
- *Bot connects to legacy chat via IRC*: Excluded per brief.
- *Separate dedicated bot account*: Original design; superseded — the bot now reuses the broadcaster's own account for both reading and sending chat messages, removing the need to register, authorize, and grant `channel:bot` access to a second Twitch account.

**New consideration — reply-loop prevention**: Because the bot now sends messages from the same account whose messages it also reads via EventSub (and the broadcaster is exempt from cooldowns per FR-007), the bot MUST tag or otherwise recognize its own outgoing messages (e.g. by comparing the incoming message's sender user ID to the broadcaster/bot user ID *and* matching against a short-lived set of recently-sent message IDs/text) and skip command processing for them, per FR-016.

## 4. Identifying broadcaster/moderator role per message

**Decision**: Read the role directly from each incoming `channel.chat.message` EventSub payload's `badges` (or `chatter_is_broadcaster` / moderator badge entry) fields — no separate role lookup or caching.

**Rationale**: The payload already includes the chatter's current badges for that message, satisfying the requirement that role checks reflect current state rather than a stale cache (spec edge case: moderator demoted mid-session). Avoids an extra Helix "Get Moderators" call per message.

**Alternatives considered**:
- *Periodic Helix "Get Moderators" polling with local cache*: Adds staleness risk and complexity; rejected since the per-message badge data is already authoritative and free.

## 5. Storage engine

**Decision**: SQLite via the built-in `node:sqlite` module (`DatabaseSync`), not `better-sqlite3`.

**Rationale**: The project targets Node.js 24, where `node:sqlite` ships stable and unflagged. It offers the same core shape as `better-sqlite3` for this project's needs — a synchronous API (`prepare`, `.run`/`.get`/`.all`), transactions, and parameterized statements — which is exactly what the cooldown/command read-modify-write paths need (see §6). Using the built-in module means one fewer dependency to install, version-pin, and rebuild as a native addon on each target machine/CI image (`better-sqlite3` ships prebuilt binaries per Node ABI/platform and needs a rebuild step whenever that falls through). For a small, single-process bot with a two-table schema, `node:sqlite` provides everything required (synchronous queries, transactions, `UNIQUE`/foreign-key constraints, prepared statements) with no functional gap that would justify pulling in a third-party native module.

**Comparison**:

| | `node:sqlite` (built-in) | `better-sqlite3` |
|---|---|---|
| Dependency footprint | None — part of Node 24 | Extra native dependency; prebuilt binary per platform/ABI, rebuild risk on unsupported combos |
| API style | Synchronous (`DatabaseSync`), close to `better-sqlite3`'s shape | Synchronous |
| Transactions | Supported (`db.exec('BEGIN')`/manual, or `StatementSync` inside a manual transaction) | Supported via a dedicated `db.transaction()` helper — slightly more ergonomic |
| Maturity/ecosystem | Newer (stabilized in recent Node versions); smaller body of community examples | Long-established, widely used, more community tooling/examples |
| Fit for this project | Sufficient — schema is two small tables, no advanced extensions needed | Also sufficient, but adds a dependency for no functional gain here |

**Alternatives considered**:
- *`better-sqlite3`*: Slightly more mature ergonomics (e.g., a built-in `.transaction()` wrapper) and a larger track record, but adds a native dependency with prebuilt-binary/rebuild concerns that `node:sqlite` avoids entirely now that Node 24 is the target. Rejected in favor of the zero-dependency built-in, per the preference to avoid an unnecessary native dependency when the built-in already covers the need.
- *An ORM (Prisma/Drizzle)*: Adds a build/generation step and abstraction for a schema of two small tables. Rejected as unnecessary weight; plain SQL via `node:sqlite` is sufficient and keeps cooldown-path queries transparent.

## 6. Cooldown enforcement mechanism

**Decision**: Store `last_used_at` (global) on the command row itself, plus a separate per-(command, user) `last_used_at` table for personal cooldowns. On each non-exempt invocation, compare `now - last_used_at` against the fixed 10s/30s thresholds before replying, and update both on a successful (non-cooldown-blocked) invocation.

**Rationale**: Two lightweight timestamp comparisons per invocation are enough to satisfy FR-008/FR-009 without needing in-memory rate-limiter libraries; persisting to SQLite means cooldown state survives a bot restart (consistent with FR-015 covering commands, and preventing a restart from being used to bypass cooldowns).

**Alternatives considered**:
- *In-memory-only cooldown maps*: Simpler, but state resets on restart, which is undesirable) and doesn't scale cleanly if the process is ever split. Rejected in favor of durable storage that's already available (SQLite).

## 7. Testing approach

**Decision**: `vitest` for unit and integration tests, with EventSub/Helix calls mocked at the Twurple client boundary.

**Rationale**: Vitest has fast TypeScript-native execution (no separate ts-jest transform step) and a Jest-compatible API, suiting a small Node/TS service.

**Alternatives considered**:
- *Jest*: Works fine too, but requires extra TS transform configuration. Vitest chosen for simpler TS-first setup.

## 8. Project type

**Decision**: Single Node.js background service (long-running process), no HTTP server exposed and no frontend — a CLI-style daemon started with `pnpm start`.

**Rationale**: Matches "simple local/single-process deployment" from the brief; there is no user-facing web/API surface in this feature (a management UI is explicitly deferred).

## 9. Linting under TypeScript 7

**Decision**: ESLint runs with `@eslint/js` recommended rules only; `.ts` sources are excluded from ESLint's scope (`eslint.config.js`). `pnpm run build` (`tsc`) remains the syntax/type check for TypeScript files.

**Rationale**: The project targets TypeScript 7, a ground-up rewrite with no classic JS compiler API. As of this writing, neither `typescript-eslint` nor `@typescript-eslint/parser` (8.67.0, the latest release) support it — both hard-fail at startup with "typescript-eslint does not support TS 7.0" (tracked at https://github.com/typescript-eslint/typescript-eslint/issues/10940), so no ESLint parser in the current ecosystem can read this project's `.ts` files at all. Rather than pin an older TypeScript just to keep a linter working, `.ts` files are excluded from ESLint and left to `tsc`, which already catches syntax and type errors authoritatively; ESLint continues to cover any plain `.js` config files in the repo.

**Alternatives considered**:
- *Pin `typescript` back to 6.x for linting only, via a scoped dependency override*: Would keep `typescript-eslint` working, but reintroduces exactly the older-TypeScript dependency the user asked to move away from, and pnpm overrides can't cleanly scope "TS 6 for eslint, TS 7 for tsc" without real risk of the override leaking into the build. Rejected as more fragile than just deferring TS-aware linting.
- *Wait to upgrade TypeScript until `typescript-eslint` supports TS 7*: Contradicts the explicit instruction to update to TypeScript 7 now. Rejected.
- *Revisit once `typescript-eslint` ships TS 7 support*: Re-enable the TS-aware ESLint config (restore `typescript-eslint` as a devDependency, drop the `**/*.ts` ignore) at that point — tracked via the GitHub issue linked above.
