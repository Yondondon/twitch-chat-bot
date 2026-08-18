# Implementation Plan: Commands Management UI

**Branch**: `002-commands-ui` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-commands-ui/spec.md`

## Summary

Add a web dashboard for viewing and (for broadcaster/moderators) managing chat
commands, backed by Twitch OAuth sign-in for role verification. The repo
converts from a single package to a pnpm monorepo: the existing bot becomes
`backend/` (gaining an HTTP API alongside its existing chat/EventSub process)
and a new `ui/` package hosts a React dashboard. Both UI and chat management
read/write the same `commands` table via the existing `CommandRepository`, so
FR-011 (single source of truth) falls out of reuse rather than new sync logic.

## Technical Context

**Language/Version**: TypeScript 5 (existing `typescript@^7.0.2` in repo — actually a pre-release major; kept as-is), Node.js >=24

**Primary Dependencies**:
- Backend: Fastify (HTTP API), `@fastify/cookie` + `@fastify/cors`, `jose` (JWT session cookie), existing `@twurple/api`/`@twurple/auth` (Helix calls, chat)
- UI: React 19, Vite, TanStack Router, TanStack Query, Zustand (only if a cross-tree ephemeral-state need arises), shadcn/ui, Tailwind CSS

**Storage**: SQLite via `node:sqlite` (existing `commands` table, unchanged schema)

**Testing**: Vitest (backend, existing) + Vitest/React Testing Library (UI, new)

**Target Platform**: Linux server (backend process(es)); static SPA served to any modern browser

**Project Type**: Web application (monorepo: `backend/` + `ui/`)

**Performance Goals**: Dashboard list loads within a few seconds (SC-003); management actions complete well under 30s end-to-end (SC-001) — no unusual perf requirements beyond standard REST/SPA responsiveness

**Constraints**: Single Twitch channel scope (existing assumption); role must be re-verified live (not cached) on every management action (FR-003, assumption "Session/role freshness"); no real-time/push updates required (list is current as of last load)

**Scale/Scope**: Single-channel bot, small command counts (tens, not thousands); 2 new routes/pages (Home, Commands) plus auth callback handling

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is still the
unfilled template — no ratified principles exist to check against. No gates
apply; this section is a no-op until the constitution is populated.

## Project Structure

### Documentation (this feature)

```text
specs/002-commands-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   ├── api.md            # Backend REST API contract
│   └── ui.md              # UI routes/pages contract
└── tasks.md               # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
pnpm-workspace.yaml        # packages: backend, ui
package.json                # root: shared devDeps + workspace-wide scripts

backend/
├── src/
│   ├── commands/           # unchanged: parser, permissions, service, cooldown, selfMessage
│   │   └── service.ts       # gains renameable edit for UI (trigger + replyText)
│   ├── storage/             # unchanged: db.ts, commandRepository.ts, migrations/
│   ├── twitch/               # unchanged: auth.ts, chat.ts, eventsub.ts, types.ts
│   │                          # + helix moderator lookup for role checks
│   ├── http/                  # NEW: Fastify API server
│   │   ├── server.ts
│   │   ├── routes/
│   │   │   ├── commands.ts
│   │   │   └── auth.ts
│   │   ├── session.ts        # JWT cookie issue/verify
│   │   └── role.ts            # live broadcaster/moderator check via Helix
│   ├── config.ts               # extended: OAuth redirect URI, session secret, UI origin, port
│   ├── index.ts                  # unchanged entry: chat/EventSub bot process
│   └── server-entry.ts             # NEW entry: HTTP API process
├── tests/
└── package.json (renamed from root; scripts: build/start/dev/migrate/test/lint)

ui/
├── src/
│   ├── routes/                # TanStack Router route tree
│   │   ├── __root.tsx           # header nav, shared layout
│   │   ├── index.tsx              # Home: greeting + username
│   │   └── commands.tsx            # Commands page: list + manage
│   ├── components/                  # shadcn-generated + feature components
│   ├── lib/
│   │   ├── api.ts                    # typed fetch client for backend REST API
│   │   └── queryClient.ts
│   ├── stores/                        # Zustand stores (added only if needed)
│   ├── main.tsx
│   └── index.css                        # Tailwind entry, dark-only theme
├── index.html
├── vite.config.ts                        # dev proxy: /api -> backend
├── tailwind.config.ts
├── components.json                          # shadcn config
└── package.json
```

**Structure Decision**: Web application monorepo (Option 2 pattern), named
`backend/` + `ui/` per explicit user direction rather than `backend/frontend`
generic naming. `backend/` absorbs the existing `src/` unchanged plus a new
`http/` module for the REST API; the pre-existing chat bot process (`index.ts`)
and the new HTTP API (`server-entry.ts`) are separate Node processes sharing
the same SQLite file and `CommandRepository`, avoiding cross-process coupling
while satisfying FR-011 (same underlying data).

## Complexity Tracking

*No constitution violations — table not applicable.*
