# Phase 0 Research: Commands Management UI

## 1. Monorepo tooling

**Decision**: pnpm workspaces (`pnpm-workspace.yaml` listing `backend` and `ui`), no Turborepo/Nx.

**Rationale**: Repo already uses pnpm. Two packages with no shared internal libraries and no need for cross-package build-graph caching — a workspace-scripts-only setup (`pnpm --filter`) is sufficient. Matches user instruction ("no need to separate repos... change it to monorepo").

**Alternatives considered**: Turborepo (adds caching/pipeline config for no real benefit at this scale — rejected as premature); separate git repos (explicitly rejected by user); npm/yarn workspaces (no reason to leave pnpm, already in use).

## 2. Backend HTTP framework

**Decision**: Fastify, with `@fastify/cors` and `@fastify/cookie`.

**Rationale**: TypeScript-first, low overhead, matches the codebase's minimal-dependency style better than a heavier framework. Built-in schema-based validation (via JSON schema or a TypeBox/zod adapter) is convenient for the small CRUD surface (list/create/edit/delete commands).

**Alternatives considered**: Express (larger ecosystem but weaker native TS support, needs extra middleware for equivalent functionality); raw `node:http` (would mean hand-rolling routing/CORS/cookies for no benefit given Fastify's small footprint).

## 3. Twitch sign-in

**Decision**: Twitch OAuth2 Authorization Code Grant, handled entirely by the backend (`GET /api/auth/login` → Twitch → `GET /api/auth/callback`). On success the backend sets an httpOnly, `SameSite=Lax`, signed session cookie (JWT via `jose`) containing only the signed-in user's Twitch user id and login name — no role. Redirects back to the UI's origin afterward.

**Rationale**: Keeping the OAuth client secret and token exchange server-side avoids exposing it to the browser (implicit/PKCE-in-SPA flows are unnecessary complexity here since the backend already fronts the API). The cookie identifies *who* is signed in; it deliberately does not cache *role*, so role can be re-verified live per request (assumption: "Session/role freshness").

**Alternatives considered**: SPA-side PKCE flow with token stored in the browser (more moving parts, and the UI would need to call Twitch's Helix API directly with a user token just to determine role — duplicating logic the backend already needs for chat-based role checks); server-side session store/table (unnecessary — a signed JWT cookie needs no persistence and there's no need to support server-side revocation beyond cookie expiry for this feature).

**New env vars needed**: `TWITCH_REDIRECT_URI`, `SESSION_SECRET`, `UI_ORIGIN` (for CORS + post-login redirect), `HTTP_PORT`.

## 4. Role verification (broadcaster/moderator check)

**Decision**: On every mutating request (`POST`/`PATCH`/`DELETE` on `/api/commands`), the backend derives the caller's role fresh: broadcaster if the session's user id equals `config.broadcasterUserId`; otherwise moderator if present in the result of Twitch Helix "Get Moderators" (`GET /moderation/moderators`), called with the broadcaster's existing `RefreshingAuthProvider` (already available — no new auth scope needed since the broadcaster already grants `channel:moderate`-adjacent access implicitly through existing chat scopes; verify/add the `moderation:read` scope on the broadcaster token if missing). Result is used once per request, never cached across requests.

**Rationale**: Matches the existing chat-side `getChatterRole` philosophy (compute fresh, no cache) and satisfies FR-003/FR-007 and the demotion/promotion edge case without inventing a new mechanism.

**Alternatives considered**: Caching moderator list with a TTL (rejected — spec explicitly requires freshness on each action, and moderator lists are small/cheap to fetch); trusting a role claim embedded in the JWT at login time (rejected — would go stale exactly in the demotion scenario the spec calls out).

## 5. Command edit semantics (trigger rename)

**Decision**: Extend `CommandService` with a UI-oriented edit method (or generalize the existing `editCommand`) accepting an optional new trigger alongside replyText, checking reserved-trigger and case-insensitive duplicate rules against *other* commands (excluding the command being edited) before writing.

**Rationale**: Spec assumption states the UI's edit is a superset of chat's (direct rename vs. chat's remove-then-add), and `CommandRepository` already has the primitives (`findByTrigger`, `updateReplyText`) needed — just needs a trigger-update path and duplicate-check-excluding-self.

**Alternatives considered**: Reusing chat's remove+add semantics in the UI (rejected — spec explicitly calls for single-action rename).

## 6. UI stack specifics

**Decision** (per explicit user direction, confirmed suitable for this scope):
- **Framework**: React 19 + Vite (fast dev server, first-class TanStack Router/shadcn support; React 19 is current and compatible with TanStack Router/Query)
- **Routing**: TanStack Router, code-based route tree (small route count: `/` and `/commands`) with a root layout providing the header nav
- **Data fetching**: TanStack Query for all server state (`GET /api/commands`, `GET /api/auth/me`, mutations for create/edit/delete) — no manual fetch-in-`useEffect`
- **State management**: No global client-state library needed initially — TanStack Query's cache covers server state (including auth/role, via `useQuery(['auth','me'])`), and per-page UI state (e.g. "which command is being edited") stays local `useState` in the owning component. Zustand is added as a dependency only if/when a genuinely cross-tree ephemeral state need appears (per user: "if there is a need for state manager - use Zustand"); no Context usage per user instruction.
- **UI components**: shadcn/ui (table, dialog, form, button, input, sonner/toast for action feedback)
- **Styling**: Tailwind CSS, dark-only (no light theme, no theme toggle — `class="dark"` fixed on `<html>`)

**Alternatives considered**: Redux/Context for auth state (explicitly excluded by user); Next.js (unnecessary — no SSR/SEO requirement here, adds a server runtime the user didn't ask for; Vite SPA is simpler and pairs cleanly with the separate Fastify API).

## 7. Dev/build orchestration

**Decision**: Root `package.json` gets `dev`/`build`/`test`/`lint` scripts that fan out via `pnpm --filter` to both packages; `concurrently` (or `pnpm run -r --parallel`) runs backend HTTP API + UI dev servers together for local dev. Vite dev server proxies `/api/*` to the backend to avoid CORS friction in dev; production serves the UI as a static build (path/hosting mechanism left open — e.g. reverse proxy or backend static-file serving — not required for this feature to function, since the API works regardless of how the built UI is hosted).

**Rationale**: Keeps day-to-day commands simple (`pnpm dev` from root) without introducing a heavier monorepo task runner.

**Alternatives considered**: Nx/Turborepo pipelines (rejected as above — premature for 2 packages).
