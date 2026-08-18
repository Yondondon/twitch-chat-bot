# UI Contract (Routes & Pages)

Dark-only theme, header navigation (no sidebar), per user direction.

## Layout (`__root.tsx`)

Header with: app/bot name, nav links (`Home`, `Commands`), and a right-aligned
auth control:
- Anonymous: "Sign in with Twitch" button → `GET /api/auth/login`
- Signed in: display name + "Sign out" → `POST /api/auth/logout`, then invalidate `['auth','me']` query

Auth state comes from `useQuery(['auth','me'])` against `GET /api/auth/me`,
read by any component that needs it (no Context/provider beyond TanStack
Query's own).

## Route: `/` (Home)

Contents only: a greeting and the signed-in user's name (per user
instruction — no other widgets).
- Signed in: "Welcome back, {displayName}."
- Anonymous: a generic greeting (e.g. "Welcome.") with no name, since there's
  no user to name (FR-003 — sign-in isn't required to browse).

## Route: `/commands` (Commands)

- Always renders the command list (trigger + reply text) via
  `useQuery(['commands'], GET /api/commands)` — visible to everyone (FR-002).
- If `role` is `broadcaster` or `moderator`: show an "Add command" button
  opening a shadcn `Dialog` with a form (trigger, reply text); each row gets
  Edit/Delete controls. Edit opens the same dialog pre-filled, allowing
  trigger rename (data-model.md).
- If `role` is `other` or `anonymous`: no add/edit/delete controls rendered
  at all (FR-007) — not merely disabled, per spec's "hiding... those
  controls".
- Mutations use TanStack Query `useMutation`, invalidating `['commands']` on
  success; validation/duplicate errors from the API (400/409) surface as
  inline form errors or a toast.
- A `401`/`403` on a mutation (e.g. role changed mid-session) surfaces a
  toast and re-fetches `['auth','me']` so controls disappear/update
  (matches the demotion edge case).

## Non-goals for this contract

- No live/real-time updates while a page stays open (spec: reload to refresh).
- No settings beyond trigger/reply text (no cooldown config UI, per spec's Assumptions).
