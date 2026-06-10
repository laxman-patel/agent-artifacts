# Agent Artifacts

Versioned, access-controlled artifact hosting for HTML, Markdown, and JSX (Preact) outputs created by humans or agents.

## Implementation Parts

1. Foundation: monorepo, type system, database schema, auth/policy/storage foundations, API and web shells.
2. Artifact core: create/update/read services, immutable versions, object storage writes, audit events.
3. Web experience: dashboard, artifact viewer, history, diffs, access settings, Google sign-in flows.
4. MCP experience: MCP server, tool schemas, agent/API-key auth, shared authorization checks.
5. CLI: `artifacts` command for agents — REST API wrapper, JSON output, `artifacts schema` introspection.
6. Renderers and hardening: Markdown, HTML, JSX (Preact) rendering, collaboration controls, security tests, observability.

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

## MCP clients

The API exposes an MCP server at `/mcp` and OAuth discovery metadata on the public web origin.

For local development:

```bash
bun install
bun run db:migrate
bun run dev
```

Then configure MCP clients with:

- Server URL: `http://localhost:3000/mcp`
- Protected resource metadata: `http://localhost:3000/.well-known/oauth-protected-resource`
- Authorization server metadata: `http://localhost:3000/.well-known/oauth-authorization-server`

Standard clients should dynamically register, complete browser consent, exchange the authorization code for a token, then call tools such as `get_current_principal`.

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

## Observability

Operational logs ship to [Better Stack](https://betterstack.com/) when source tokens are configured. Without them, both apps still boot and log to stdout (API) or the console (`@logtail/next` fallback).

### Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `BETTER_STACK_SOURCE_TOKEN` | API | Server-side API logs (`@logtail/node`) |
| `BETTER_STACK_INGESTING_URL` | API | API log ingest host (https URL) |
| `BETTER_STACK_WEB_SOURCE_TOKEN` | Web (server) | Next.js server-side logs; mapped to `BETTER_STACK_SOURCE_TOKEN` at build/runtime |
| `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN` | Web (browser) | Browser logs via `/_betterstack` proxy |
| `NEXT_PUBLIC_BETTER_STACK_INGESTING_URL` | Web (browser) | Browser ingest host; also drives CSP `connect-src` |
| `LOG_IP_SALT` | API | Salt for hashing client IPs when `TRUST_PROXY=true` |
| `ENABLE_BILLING_CRON` | API | Set to `true` to run daily storage metering inside the API process |
| `BILLING_CRON_INTERVAL_MS` | API | Optional scheduler interval override for dev/test |
| `BILLING_CRON_SECRET` | API | Bearer token for the manual/internal billing snapshot endpoint |
| `BETTER_STACK_HEARTBEAT_URL_*` | (future) | Stub for cron/heartbeat monitors |

In production, the API emits a single boot warning if `BETTER_STACK_SOURCE_TOKEN` / `BETTER_STACK_INGESTING_URL` are missing. Tests force-disable Better Stack transport.

### What gets logged

- **API** — structured request logs (level by status), rate-limit and CSRF rejections, unhandled errors, and a mirror `audit_event` line for every DB audit insert (metadata excluded).
- **Web** — Web Vitals (automatic), client error boundary, OAuth login errors (`?error=`), and failed internal API fetches from server components.
- **Correlation** — the web app forwards `x-request-id` to the API on server-side fetches.

CI builds set `productionBrowserSourceMaps=true` when `CI=true` so production stack traces can be symbolicated in Better Stack.

### Uptime monitors (create manually in Better Stack)

| Monitor | URL | Type | Interval | Why |
| --- | --- | --- | --- | --- |
| API health | `<api-host>/health` | HTTP keyword `"ok":true` | 60s | Container alive |
| Web root | `<public-app-url>/` | HTTP 200 | 60s | Frontend reachable |
| OAuth callback | `<public-app-url>/api/auth/callback/google` | HTTP keyword (must not 500) | 5m | OAuth misconfig alert |
| SSL cert | apex domain | SSL expiry | daily | Cert rotation |

### Billing Scheduler

Set `ENABLE_BILLING_CRON=true` on one API instance to record daily `artifact.storage_gb_days` usage events for active paid accounts. The job calls billing services directly; `POST /api/internal/billing/storage-snapshots` remains available for external schedulers when authenticated with `BILLING_CRON_SECRET`.

### Better Stack MCP server

Install the remote Better Stack MCP server in your MCP client for querying logs and incidents from an agent. See [Better Stack MCP integration docs](https://betterstack.com/docs/getting-started/integrations/mcp/).
