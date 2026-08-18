---

description: "Task list for Commands Management UI"
---

# Tasks: Commands Management UI

**Input**: Design documents from `/specs/002-commands-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/ui.md, quickstart.md

**Tests**: A small set of integration/regression tests is included where auth/permission correctness or non-regression of existing chat behavior is at stake; not a full TDD suite.

**Organization**: Tasks are grouped by user story (US1/US2/US3, per spec.md) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: US1, US2, or US3 — maps to spec.md's user stories
- File paths are relative to repo root; `backend/` and `ui/` are the two new workspace packages (plan.md)

---

## Phase 1: Setup

**Purpose**: Convert the repo to a pnpm monorepo and scaffold both packages.

- [X] T001 Convert repo to a pnpm workspace: add `pnpm-workspace.yaml` entries for `backend` and `ui`; move existing `src/`, `tests/`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `eslint.config.js` into `backend/`; rename/update `backend/package.json` (same scripts: build/start/dev/migrate/test/lint); trim root `package.json` to workspace-level concerns only
- [X] T002 Scaffold `ui/` package (Vite + React 19 + TypeScript): `ui/package.json`, `ui/index.html`, `ui/src/main.tsx`, `ui/tsconfig.json`, `ui/vite.config.ts`
- [X] T003 [P] Configure Tailwind CSS in `ui/`: `ui/tailwind.config.ts`, `ui/postcss.config.js`, `ui/src/index.css` (dark-only — `class="dark"` fixed on `<html>` in `ui/index.html`, no light theme/toggle)
- [X] T004 [P] Initialize shadcn/ui in `ui/`: `ui/components.json` + add `button`, `input`, `dialog`, `alert-dialog`, `table`, `form`, `sonner` components under `ui/src/components/ui/`
- [X] T005 [P] Add TanStack Router to `ui/`: install deps, create `ui/src/router.ts` and a placeholder `ui/src/routes/__root.tsx`, wire `RouterProvider` in `ui/src/main.tsx`
- [X] T006 [P] Add TanStack Query to `ui/`: install deps, create `ui/src/lib/queryClient.ts`, wrap the app with `QueryClientProvider` in `ui/src/main.tsx`
- [X] T007 Add root workspace scripts (`dev`/`build`/`test`/`lint` fanning out via `pnpm --filter`/`pnpm -r`) to root `package.json`; install `concurrently` for running backend HTTP API + UI dev servers together; configure `/api` dev proxy to the backend in `ui/vite.config.ts`
- [X] T008 [P] Extend `backend/.env.example` and `backend/src/config.ts` with `TWITCH_REDIRECT_URI`, `SESSION_SECRET`, `UI_ORIGIN`, `HTTP_PORT` (research.md §3)

**Checkpoint**: `pnpm install` succeeds at root; `backend` and `ui` are independent workspace packages; existing backend tests/build still pass after the move.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The HTTP API server, session/role infrastructure, and UI app shell that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T009 Add `fastify`, `@fastify/cors`, `@fastify/cookie`, `jose` to `backend/package.json` dependencies
- [X] T010 [P] Create `backend/src/http/session.ts`: issue/verify a signed JWT session cookie (user id + login only, no role) via `jose`, keyed by `SESSION_SECRET` (research.md §3)
- [X] T011 [P] Create `backend/src/http/role.ts`: `resolveRole(auth, config, twitchUserId)` → `"broadcaster" | "moderator" | "other"`, broadcaster via `config.broadcasterUserId` match, moderator via live Twitch Helix "Get Moderators" using the existing `broadcasterAuthProvider` (research.md §4) — never cached
- [X] T012 Create `backend/src/http/server.ts`: Fastify server factory registering `@fastify/cors` (origin `UI_ORIGIN`, `credentials: true`) and `@fastify/cookie`
- [X] T013 Extend `backend/src/commands/service.ts`: add trigger-rename support to command editing (optional new trigger + reply text), checking reserved-trigger and case-insensitive duplicate rules against other commands, excluding the command being edited (research.md §5, data-model.md) — reused by both the new PATCH route and, unchanged, by the chat path
- [X] T014 Create `backend/src/http/routes/auth.ts`: `GET /api/auth/login`, `GET /api/auth/callback`, `GET /api/auth/me`, `POST /api/auth/logout` per contracts/api.md, using `session.ts`
- [X] T015 Create `backend/src/http/routes/commands.ts` with `GET /api/commands` (public, no auth) per contracts/api.md
- [X] T016 Create `backend/src/server-entry.ts`: new HTTP API process entry point — `loadConfig`, `openDatabase`, `createAuthProviders`, build the Fastify server (T012), register `auth.ts` and `commands.ts` routes, listen on `HTTP_PORT`
- [X] T017 [P] Add `backend/package.json` scripts `dev:server`/`start:server` for `server-entry.ts`, alongside the existing chat-bot `dev`/`start` scripts
- [X] T018 [P] Create `ui/src/lib/api.ts`: typed fetch client (`credentials: "include"`) with `getCommands()`, `getMe()`, `createCommand()`, `updateCommand()`, `deleteCommand()`, `login()`, `logout()` helpers against `/api/*`
- [X] T019 Implement `ui/src/routes/__root.tsx`: header with nav links (Home, Commands) and an auth control (sign in/out) driven by `useQuery(['auth','me'], api.getMe)` (contracts/ui.md) — no sidebar, no Context
- [X] T020 [P] Create `ui/src/routes/index.tsx` (Home): greeting plus the signed-in user's display name, via the same `['auth','me']` query; generic greeting with no name when anonymous (contracts/ui.md)

**Checkpoint**: `GET /api/commands` and the full auth cycle (`login` → `callback` → `me` → `logout`) work end-to-end; the UI shell renders with working nav and auth state. User story phases can now start.

---

## Phase 3: User Story 1 - Broadcaster/moderator manages commands from a web UI (Priority: P1) 🎯 MVP

**Goal**: Broadcaster/moderator can create, edit (including trigger rename), and remove commands from the dashboard, with changes immediately live in chat.

**Independent Test**: Sign in as broadcaster (or moderator), create a command via the dashboard, confirm it appears in the list and works in chat; edit it; remove it; confirm each change is reflected in both the UI list and chat (spec.md US1).

- [X] T021 [US1] Add `POST /api/commands` to `backend/src/http/routes/commands.ts`: role-gated (broadcaster/moderator via `role.ts`), calls `CommandService.addCommand`, maps outcomes to `201`/`400`/`401`/`403`/`409` per contracts/api.md
- [X] T022 [US1] Add `PATCH /api/commands/:id` to `backend/src/http/routes/commands.ts`: role-gated, calls the T013 rename-capable edit, maps outcomes to `200`/`400`/`401`/`403`/`404`/`409`
- [X] T023 [US1] Add `DELETE /api/commands/:id` to `backend/src/http/routes/commands.ts`: role-gated, calls `CommandService.removeCommand`, maps outcomes to `204`/`401`/`403`/`404`
- [X] T024 [P] [US1] Integration test in `backend/tests/http/commands.test.ts` covering role gating (401 anonymous, 403 non-mod), duplicate-trigger (409), empty-field validation (400), and success paths for POST/PATCH/DELETE
- [X] T025 [US1] Create `ui/src/routes/commands.tsx`: fetch and render the command list (trigger, reply text) via `useQuery(['commands'], api.getCommands)`
- [X] T026 [US1] Add role-gated "Add command" button + shadcn `Dialog`/`Form` (`ui/src/components/CommandDialog.tsx`) wired to a `useMutation` calling `api.createCommand`; invalidate `['commands']` on success; surface `400`/`409` errors inline in the form
- [X] T027 [US1] Add an Edit control per row opening `CommandDialog` pre-filled (trigger + reply text, rename supported), wired to a `useMutation` calling `api.updateCommand`
- [X] T028 [US1] Add a Delete control per row with a shadcn `AlertDialog` confirmation, wired to a `useMutation` calling `api.deleteCommand`; invalidate `['commands']` on success
- [X] T029 [US1] Handle `401`/`403` on any mutation in `ui/src/routes/commands.tsx`: show a toast (shadcn `sonner`) and invalidate `['auth','me']` so controls update/disappear immediately (demotion edge case, contracts/ui.md)

**Checkpoint**: User Story 1 fully functional — validate via quickstart.md "Validate User Story 1" (steps 1-7).

---

## Phase 4: User Story 2 - Anyone views the command list without signing in (Priority: P2)

**Goal**: Any visitor — anonymous or signed in but not broadcaster/moderator — sees the full, current command list with zero management controls and no sign-in gate.

**Independent Test**: Without signing in, open the dashboard and confirm the full list is visible with no add/edit/remove controls; confirm the same for a signed-in non-mod/broadcaster viewer (spec.md US2).

- [X] T030 [P] [US2] Integration test confirming `GET /api/commands` returns `200` with the full list when no session cookie is present (`backend/tests/http/commands.test.ts`)
- [X] T031 [US2] Ensure `ui/src/routes/commands.tsx`'s list query has no dependency on auth state (renders immediately regardless of sign-in), and that Add/Edit/Delete controls are omitted entirely from the DOM (not merely disabled) when role is `"anonymous"` or `"other"` (contracts/ui.md)
- [X] T032 [P] [US2] UI test in `ui/src/routes/commands.test.tsx` verifying an anonymous visitor sees the list with no controls and no sign-in prompt blocking it, and that a signed-in non-mod/broadcaster user sees the identical read-only view

**Checkpoint**: User Story 2 verified — validate via quickstart.md "Validate User Story 2".

---

## Phase 5: User Story 3 - Chat-based command management continues to work unchanged (Priority: P1)

**Goal**: Chat-based add/edit/remove keeps working exactly as before, and stays visible through the UI/API (same underlying data, FR-011).

**Independent Test**: With the UI available, add/edit/remove a command via chat and confirm each change is reflected in the UI's list (spec.md US3).

- [X] T033 [P] [US3] Confirm existing chat-path tests (`backend/tests` for `commands/service`, `commands/parser`, `commands/permissions`) still pass unmodified after the T013 service extension — no behavior change at the chat call sites
- [X] T034 [US3] Integration test in `backend/tests/http/commands.test.ts` (or a new `backend/tests/integration/shared-data.test.ts`) proving a chat-path add/edit/delete (via `CommandService`/`CommandRepository` directly) is immediately visible through `GET /api/commands`, and vice versa
- [ ] T035 [US3] Run quickstart.md's "Validate User Story 3" steps end-to-end (chat add/edit/delete, confirmed via UI reload) and record the results

**Checkpoint**: All three user stories independently functional and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T036 [P] Update root `README.md` with the monorepo layout, new env vars (T008), and the `pnpm dev` workflow (quickstart.md)
- [X] T037 [P] Add UI-specific dev notes (shadcn `add` workflow, dark-only theme note) to `ui/README.md` or the root README
- [ ] T038 Run the full quickstart.md validation end-to-end (all three user stories) as a final acceptance pass
- [X] T039 [P] Run `pnpm -r run lint` and `pnpm -r run test` across both packages and fix any issues surfaced by the monorepo conversion

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T002 (scaffold `ui/`) must complete before T003-T006 (which configure files inside `ui/`).
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories. T009 blocks T010-T017 (need the Fastify/jose deps installed first). T012 (server factory) blocks T014-T016 (route registration needs the server instance). T013 (service rename support) blocks T022 (US1's PATCH route).
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion.
  - **US1 (P1)**: No dependency on US2/US3 — independently testable once Foundational is done.
  - **US2 (P2)**: Builds on US1's `commands.tsx` (T025) existing, but is independently *testable* the moment T015 (public GET) and T019 (shell) are done — T031/T032 specifically verify the anonymous/non-mod path.
  - **US3 (P1)**: No new production code dependency on US1/US2 beyond T013 (Foundational) — purely regression/integration verification that the shared data layer holds.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### Parallel Opportunities

- Setup: T003, T004, T005, T006, T008 in parallel (after T002; T008 has no dependency on T002 at all)
- Foundational: T010, T011 in parallel (after T009); T017, T018 in parallel; T020 parallel with US1/US2 work once T019 lands
- US1: T024 can run parallel to T025-T029 (different files: test file vs. UI components)
- US2: T030 and T032 in parallel (different files)
- US3: T033 and T034 in parallel (different files)
- Polish: T036, T037, T039 in parallel

---

## Parallel Example: Foundational Phase

```bash
# After T009 (deps installed), in parallel:
Task: "Create backend/src/http/session.ts (JWT session cookie issue/verify)"
Task: "Create backend/src/http/role.ts (live broadcaster/moderator resolution)"

# After T019 (root layout), in parallel with starting US1/US2:
Task: "Create ui/src/routes/index.tsx (Home: greeting + username)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart.md "Validate User Story 1"
5. Demo: broadcaster manages commands end-to-end via the dashboard

### Incremental Delivery

1. Setup + Foundational → shell + read API + auth cycle all work
2. Add US1 → full management flow → demo (MVP)
3. Add US2 → confirm/lock down the anonymous read-only path
4. Add US3 → confirm chat management keeps working unchanged, visible in UI
5. Polish → docs, full quickstart pass, lint/test across both packages
