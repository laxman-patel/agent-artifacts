# Agent Artifacts

Versioned, access-controlled artifact hosting for HTML, Markdown, and React outputs created by humans or agents.

## Implementation Parts

1. Foundation: monorepo, type system, database schema, auth/policy/storage foundations, API and web shells.
2. Artifact core: create/update/read services, immutable versions, object storage writes, audit events.
3. Web experience: dashboard, artifact viewer, history, diffs, access settings, Google sign-in flows.
4. MCP experience: MCP server, tool schemas, agent/API-key auth, shared authorization checks.
5. CLI: `artifacts` command for agents — REST API wrapper, JSON output, `artifacts schema` introspection.
6. Renderers and hardening: Markdown, HTML, React rendering, collaboration controls, security tests, observability.

## CLI (for agents)

The `artifacts` CLI is the recommended way for AI agents to use the platform. It wraps the REST API with JSON-first output and a machine-readable `artifacts schema` command.

```bash
bun run cli:build
bun run cli:install     # once: `artifacts` on PATH via ~/.local/bin
export AGENT_ARTIFACTS_BASE_URL="http://127.0.0.1:3001"

artifacts login
artifacts schema
artifacts artifact list
```

Without installing: `bun run artifacts -- <command>` from the repo root.

See [apps/cli/README.md](apps/cli/README.md).

## Development

Requires [Bun](https://bun.sh) for package management and Node.js 24+ for running apps.

```bash
bun install
bun run typecheck
bun run dev
```

Run the database migrations (`bun run db:migrate`) when bootstrapping a new environment.

Copy `.env.example` to `.env` and align:

- `BETTER_AUTH_URL` and `PUBLIC_APP_URL` must match the browser-visible origin used for OAuth redirects (default `http://localhost:3000`).
- `INTERNAL_API_URL` should point at the Hono API (`http://127.0.0.1:3001` locally). Next.js rewrites `/api/*` there so cookies stay scoped to the web origin.

During development you typically run both apps via Turbo (`bun run dev`). Optional Playwright smoke specs live in `apps/web/e2e`; start the dev servers first, install browsers once via `bunx playwright install`, then run `bun run --filter @agent-artifacts/web test:e2e`.
