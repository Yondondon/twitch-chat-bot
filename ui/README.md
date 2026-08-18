# Dashboard UI

React + Vite + TypeScript, using:

- **TanStack Router** — file-based routes in `src/routes/` (`__root.tsx` is the shared layout;
  each other file is a route, matched by its path relative to `src/routes/`)
- **TanStack Query** — all server state (`src/lib/api.ts` is the typed fetch client against the
  backend's `/api/*`); no `Context` is used for app state
- **shadcn/ui** (`src/components/ui/`) + **Tailwind CSS**
- **Dark-only theme** — `<html class="dark">` is fixed in `index.html`; there's no light theme or
  toggle. Don't add one without updating that intentionally.

## Commands

```bash
pnpm dev       # vite dev server (proxies /api to the backend — see vite.config.ts)
pnpm build     # tsc -b && vite build
pnpm test      # vitest (jsdom + React Testing Library)
pnpm lint      # oxlint
```

## Adding a shadcn component

```bash
pnpm dlx shadcn@latest add <component>
```

This project was initialized with the `radix-nova` style/preset (`components.json`); new
components are added under `src/components/ui/`.
