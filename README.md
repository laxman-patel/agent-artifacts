# Agent Artifacts

Versioned, access-controlled artifact hosting for HTML, Markdown, and React outputs created by humans or agents.

## Implementation Parts

1. Foundation: monorepo, type system, database schema, auth/policy/storage foundations, API and web shells.
2. Artifact core: create/update/read services, immutable versions, object storage writes, audit events.
3. Web experience: dashboard, artifact viewer, history, diffs, access settings, Google sign-in flows.
4. MCP experience: MCP server, tool schemas, agent/API-key auth, shared authorization checks.
5. Renderers and hardening: Markdown, HTML, React rendering, collaboration controls, security tests, observability.

## Development

```bash
corepack pnpm install
corepack pnpm typecheck
corepack pnpm dev
```

Run the database migrations (`corepack pnpm db:migrate`) when bootstrapping a new environment.

Copy `.env.example` to `.env` and align:

- `BETTER_AUTH_URL` and `PUBLIC_APP_URL` must match the browser-visible origin used for OAuth redirects (default `http://localhost:3000`).
- `INTERNAL_API_URL` should point at the Hono API (`http://127.0.0.1:3001` locally). Next.js rewrites `/api/*` there so cookies stay scoped to the web origin.

During development you typically run both apps via Turbo (`corepack pnpm dev`). Optional Playwright smoke specs live in `apps/web/e2e`; start the dev servers first, install browsers once via `pnpm exec playwright install`, then run `pnpm --filter @agent-artifacts/web test:e2e`.
