---

description: "Task list for Twitch Chat Bot feature implementation"
---

# Tasks: Twitch Chat Bot

**Input**: Design documents from `/specs/001-twitch-chat-bot/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not explicitly requested in the feature spec. No dedicated test-writing tasks are included; a light unit-test pass is offered as an optional Polish-phase task instead.

**Organization**: Tasks are grouped by user story (US1, US2) to enable independent implementation and testing of each story, per spec.md priorities (both P1).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- File paths follow the layout fixed in plan.md's Project Structure section

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project directory structure per plan.md: `src/twitch/`, `src/commands/`, `src/storage/`, `src/storage/migrations/`, `tests/unit/`, `tests/integration/`
- [X] T002 Initialize the Node.js/TypeScript project with `pnpm`: `package.json` (Node 24 engine constraint), `tsconfig.json`, a `pnpm-workspace.yaml` if needed, and dependencies `@twurple/auth`, `@twurple/api`, `@twurple/eventsub-ws` plus devDependencies `typescript`, `vitest`, `@types/node`, installed via `pnpm install` (produces `pnpm-lock.yaml`)
- [X] T003 [P] Configure linting/formatting (ESLint + Prettier configs) and `package.json` scripts (`build`, `start`, `dev`, `test`, `migrate`) runnable via `pnpm run <script>`

**Checkpoint**: Project scaffolding compiles/installs cleanly with no source code yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before either user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create SQLite schema migration `src/storage/migrations/001_init.sql` defining the `commands` and `command_user_cooldowns` tables per data-model.md, plus a migration runner in `src/storage/db.ts` that opens the database via the built-in `node:sqlite` `DatabaseSync` and applies pending migrations on startup
- [X] T005 [P] Implement environment configuration loading (Twitch client id/secret, broadcaster token, bot token, channel id, database file path) in `src/config.ts`
- [X] T006 Implement Twitch auth provider setup (broadcaster + bot account user access tokens, refresh handling via Twurple) in `src/twitch/auth.ts` (depends on T005)
- [X] T007 Implement EventSub WebSocket session lifecycle in `src/twitch/eventsub.ts`: connect, handle `session_welcome`, register the `channel.chat.message` subscription (contracts/twitch-eventsub-helix.md), and handle `session_reconnect`/disconnect by re-establishing the session and re-subscribing without manual intervention (depends on T006)
- [X] T008 Implement chat-sending wrapper in `src/twitch/chat.ts` using the Helix "Send Chat Message" endpoint authenticated as the bot account (depends on T006)

**2026-08-16 spec update — broadcaster account migration (FR-013, FR-016)**: The spec now requires the bot to send chat replies using the broadcaster's own Twitch account instead of a separate dedicated bot account. T005/T006/T008 above shipped the original (separate-account) design; the following tasks bring the implementation in line with the revised spec.

- [X] T023 [P] Remove the dedicated bot account fields (`botUserId`, `botAccessToken`, `botRefreshToken`, `BOT_USER_ID`/`BOT_ACCESS_TOKEN`/`BOT_REFRESH_TOKEN`) from `src/config.ts`; the broadcaster's own credentials are now used for both reading and sending chat (depends on none; parallel with T024 since different files)
- [X] T024 [P] Simplify `src/twitch/auth.ts` to build a single `broadcasterAuthProvider` (drop `botAuthProvider`); update the `AuthProviders` interface and its doc comment accordingly (depends on none; parallel with T023)
- [X] T025 Update `src/twitch/chat.ts` to send via `auth.broadcasterAuthProvider` instead of `auth.botAuthProvider`, and have `ChatSender.send` return the sent message's ID (`HelixSentChatMessage.id`) so callers can recognize the bot's own messages later (FR-016) (depends on T024)
- [X] T026 Add `messageId` to `IncomingChatMessage` in `src/twitch/types.ts`, and populate it from `event.messageId` in `src/twitch/eventsub.ts` (depends on none; parallel with T023-T025)
- [X] T027 Implement self-message recognition in `src/commands/selfMessage.ts` (`SelfMessageTracker`, wired into `src/index.ts`): track the IDs of messages the bot has just sent (from T025's return value) in a bounded/expiring set (30s TTL), and skip all command parsing/dispatch for an incoming message whose `messageId` (T026) matches a recently-sent ID, satisfying FR-016 (depends on T025, T026)
- [X] T028 [P] Update `.env.example` and `README.md` to drop the bot-account token/scope instructions and describe the single broadcaster token (`user:read:chat user:write:chat`) setup, per quickstart.md (depends on T023; parallel with T027)

**Verification**: `pnpm run build` and `pnpm test` both pass (24/24 unit + integration tests green) after T023-T028. `tests/unit/permissions.test.ts`'s message fixture was updated to include the new `messageId` field.
- [X] T009 [P] Implement chat message parsing (invocation trigger vs. `!addcommand`/`!editcommand`/`!delcommand` management syntax, per contracts/chat-command-syntax.md) in `src/commands/parser.ts`
- [X] T010 [P] Implement broadcaster/moderator role determination from an incoming chat message's badge data (FR-012) in `src/commands/permissions.ts`
- [X] T011 Wire a minimal process entrypoint in `src/index.ts` that loads config, starts the EventSub session, and dispatches each incoming `channel.chat.message` event to a (not-yet-implemented) command handler stub (depends on T004, T007, T009, T010)

**Checkpoint**: Foundation ready — bot connects to Twitch, receives chat messages, can determine sender role, and can send replies; user story implementation can now begin.

---

## Phase 3: User Story 1 - Manage custom commands from chat (Priority: P1) 🎯 MVP

**Goal**: Broadcaster/moderators can add, edit, and remove custom commands directly from chat; non-privileged users cannot.

**Independent Test**: As a mod, `!addcommand discord <url>` then confirm `!discord` (as any user) returns the URL; `!editcommand` updates it; `!delcommand` removes it and `!discord` stops replying; a non-mod's `!addcommand`/`!editcommand`/`!delcommand` attempts have no effect and produce no reply.

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement `CommandRepository` in `src/storage/commandRepository.ts`: `create`, `findByTrigger` (case-insensitive), `update` (reply text + `updated_at`), `delete` — per data-model.md `Command` entity (depends on T004)
- [X] T013 [US1] Implement command management service in `src/commands/service.ts`: `addCommand`, `editCommand`, `removeCommand`, each enforcing broadcaster/moderator-only access (FR-004), rejecting duplicate triggers on add (FR-005), rejecting edit/remove of a non-existent trigger, and rejecting the reserved keywords `addcommand`/`editcommand`/`delcommand` as a trigger name (depends on T012, T010)
- [X] T014 [US1] Wire management-command handling into the dispatcher in `src/index.ts`: route parsed management messages (T009) from broadcaster/moderators to the service (T013), send a chat confirmation on success (`src/twitch/chat.ts`) and a rejection reply on duplicate/not-found, and send no reply at all when a non-privileged user sends management syntax (depends on T013, T008, T011)

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently — commands can be created, edited, and removed from chat by authorized users only.

---

## Phase 4: User Story 2 - Viewers use custom commands with cooldowns (Priority: P1)

**Goal**: Any viewer can invoke an existing command and get its reply; non-privileged users are rate-limited by a fixed 10s global / 30s personal cooldown; broadcaster/moderators are exempt.

**Independent Test**: With an existing command, a viewer triggers it and gets a reply, an immediate repeat by the same viewer gets no reply for 30s, a different viewer gets no reply within 10s of the first invocation (global cooldown), and the broadcaster/a moderator can trigger it repeatedly with no restriction.

### Implementation for User Story 2

- [X] T015 [P] [US2] Add cooldown data-access methods to `src/storage/commandRepository.ts`: read/update a command's `global_last_used_at`, and read/upsert a `CommandUserCooldown` row's `last_used_at` for a given (command, user) pair — per data-model.md (depends on T012)
- [X] T016 [US2] Implement cooldown evaluation logic in `src/commands/cooldown.ts`: given a command and the invoking user's role, return whether the fixed 10s global and 30s personal cooldowns (FR-008–FR-010) currently block the invocation, exempting broadcaster/moderators entirely (FR-007) (depends on T015, T010)
- [X] T017 [US2] Wire invocation handling into the dispatcher in `src/index.ts`: on a parsed invocation message (T009), look up the command by trigger (T012), evaluate cooldowns (T016), send the reply via chat (T008) only when allowed, update `global_last_used_at`/per-user cooldown state (T015) on an allowed non-exempt invocation, and send no reply for an unknown trigger (depends on T016, T014)

**Checkpoint**: All user stories should now be independently functional — commands can be managed (US1) and invoked with correct cooldown behavior (US2).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that span both user stories

- [X] T018 [P] Add unit tests for `src/commands/parser.ts`, `src/commands/permissions.ts`, and `src/commands/cooldown.ts` in `tests/unit/` using `vitest`
- [X] T019 [P] Add an integration test covering add → invoke → cooldown-blocked → edit → invoke → remove in `tests/integration/commandFlow.test.ts`, with the Twurple client mocked
- [X] T020 Add structured logging (successful/rejected command management actions, cooldown-blocked invocations, EventSub reconnects) across `src/twitch/` and `src/commands/`
- [X] T021 [P] Write `.env.example` and a short `README.md` setup section covering the Twitch app/token setup described in quickstart.md
- [X] T022 Run the quickstart.md validation scenarios end-to-end against a live Twitch channel and fix any discrepancies found. 2026-08-16 progress: with real broadcaster credentials supplied, `pnpm run migrate` and a live bot startup succeeded (EventSub WebSocket session established, `channel.chat.message` subscribed, no subscription errors). A live send-message smoke test (`!addcommand` via the broadcaster's own account) failed with `401 User access token requires the user:write:chat scope` — the broadcaster token currently only had `user:read:chat`. **Resolved**: `BROADCASTER_ACCESS_TOKEN`/`BROADCASTER_REFRESH_TOKEN` re-authorized with scopes `user:read:chat user:write:chat`. Re-ran the live smoke test on Node 24 (`node --env-file=.env dist/index.js`): `!addcommand test <reply>` logged `outcome":"added"`, invoking `!test` replied correctly (confirmed live in chat by user), and `!delcommand test` logged `outcome":"removed"`. Broadcaster/mod management and viewer invocation confirmed working end-to-end against the live channel.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS both user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion only
- **User Story 2 (Phase 4)**: Depends on Foundational completion; also depends on T012 (`CommandRepository`) and T014 (dispatcher wiring) from User Story 1, since invocation requires commands to already be creatable and a working dispatch point — build US1 before US2
- **Polish (Phase 5)**: Depends on both user stories being complete

### Within Each User Story

- Repository/data-access before service/logic before dispatcher wiring
- US1 must land before US2 because US2 needs both an existing `CommandRepository` (T012) and the dispatcher wiring pattern established in T014

### Parallel Opportunities

- T004 and T005 (Foundational) can run in parallel — different files, no shared dependency
- T009 and T010 (Foundational) can run in parallel — different files
- T012 (US1) can start as soon as T004 lands, in parallel with other Foundational [P] tasks not yet done
- T015 (US2) can run in parallel with T013/T014 (US1) once T012 is done, though the dispatcher wiring in T017 still needs T014 finished first
- T018, T019, T021 (Polish) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch independent foundational tasks together:
Task: "Create SQLite schema migration and db.ts in src/storage/"
Task: "Implement environment configuration loading in src/config.ts"
Task: "Implement chat message parsing in src/commands/parser.ts"
Task: "Implement role determination in src/commands/permissions.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks both stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1 (command management) independently
5. Demo command add/edit/remove even before cooldown-gated invocation is fully wired

### Incremental Delivery

1. Complete Setup + Foundational → bot connects, reads chat, can reply
2. Add User Story 1 → validate with quickstart.md Scenario 1 → command management works end-to-end
3. Add User Story 2 → validate with quickstart.md Scenario 2 → cooldown-gated invocation works end-to-end
4. Polish phase → validate quickstart.md Scenario 3 (restart persistence) and add tests/logging/docs

---

## Notes

- [P] tasks touch different files with no completed-task dependency between them
- [Story] label maps each task to its user story for traceability
- Both user stories are P1 in spec.md; they are sequenced (US1 then US2) here only because US2's invocation flow reuses infrastructure US1 introduces (repository, dispatcher pattern) — not because of a spec-level priority difference
- Verify quickstart.md scenarios manually after each story's checkpoint
- Commit after each task or logical group
- 2026-08-16 update: dev environment moved to Node.js 24 (T002's engine target) and `typescript` bumped to ^7.0.2. Build/tests/migrate all verified clean on Node 24 with no `node:sqlite` experimental warning. `typescript-eslint` doesn't yet support TypeScript 7 (tracked upstream), so it was dropped and `.ts` files excluded from ESLint's scope in `eslint.config.js`; `tsc` remains the authoritative TS check — see research.md §9.
