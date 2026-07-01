<p align="center">
	<img width="150" height="150" src="./artifacts-icon.svg" alt="Artifacts logo">
</p>

<h1 align="center">Artifacts</h1>

<p align="center">
	Hosted, versioned, access-controlled URLs for everything your agents produce. Open source, agent-native, and built for teams that want durable output — not chat attachments.
</p>

<p align="center">
	<a href="https://hostartifacts.dev">Website</a>
	 |
	<a href="https://hostartifacts.dev/install.sh">CLI</a>
	 |
	<a href="https://docs.hostartifacts.dev">Docs</a>
	 |
	<a href="https://hostartifacts.dev/pricing">Pricing</a>
	 |
	<a href="https://github.com/laxman-patel/agent-artifacts">GitHub</a>
</p>

<p align="center">
	<video
		src="https://cdn.jsdelivr.net/gh/laxman-patel/agent-artifacts@main/artifacts-demo-video.mp4"
		poster="https://cdn.jsdelivr.net/gh/laxman-patel/agent-artifacts@main/.github/assets/demo-poster.jpg"
		controls
		muted
		autoplay
		loop
		playsinline
		width="100%">
		<a href="https://cdn.jsdelivr.net/gh/laxman-patel/agent-artifacts@main/artifacts-demo-video.mp4">
			<img src="https://cdn.jsdelivr.net/gh/laxman-patel/agent-artifacts@main/.github/assets/demo-poster.jpg" alt="Artifacts demo preview" width="100%">
		</a>
	</video>
</p>

Artifacts is the hosted home for agent output — HTML reports, Markdown specs, JSX prototypes, review surfaces, and throwaway tools. Every artifact gets a permanent URL, immutable version history, safe rendering, scoped access controls, and the same authorization model across the web app, REST API, MCP server, and CLI.

Use Artifacts for product demos, bug reports, onboarding docs, research synthesis, design explorations, PR reviews, async standups, client updates, and any moment where a shareable link beats another file in Downloads.

## Why Artifacts

- **Publish once, link forever.** Every artifact gets a stable URL at `hostartifacts.dev/{workspace}/{project}/{artifact}` — no temp paths, no re-uploads, no attachments lost in a chat log.
- **Immutable version history.** Each update appends a new version. Diff any two, restore an earlier one, or fork without losing history.
- **Safe rendering by default.** HTML runs in a sandbox, Markdown is sanitized, and JSX executes on a Preact-compatible runtime — built for untrusted agent output.
- **Access control that sticks.** Public, private, email allowlist, or scoped share links. View and edit permissions are modeled independently; the URL stays the same.
- **Three equal surfaces.** Humans and agents use the same model through the web UI, REST API, and MCP server — no shadow APIs or permission drift.
- **Agent-ready CLI.** One command publishes a file and returns a hosted URL. JSON output, stable exit codes, and `artifacts schema` for machine-readable discovery.
- **Team workspaces.** Move artifacts from a personal workspace into a team when shared context outgrows a single owner.
- **Own your deployment.** Run the full stack yourself with Docker, Railway, or your own infrastructure while keeping Neon Postgres and S3-compatible storage external.

## Artifact Types

| Type | Best for | How it renders |
| --- | --- | --- |
| `html` | Reports, dashboards, mockups, interactive explainers | Sandboxed HTML with browser isolation |
| `md` | Specs, notes, research writeups, PR summaries | Sanitized, GitHub-flavored Markdown |
| `jsx` | Prototypes, interactive tools, UI explorations | Preact-compatible runtime with `react` aliased to `preact/compat` |

## Surfaces

Artifacts exposes the same authorization and artifact model everywhere agents and humans interact with the platform.

| Surface | Best for | Entry point |
| --- | --- | --- |
| Web app | Viewing, sharing, history, diffs, access settings | [hostartifacts.dev](https://hostartifacts.dev) |
| CLI | Agent automation, CI, local workflows | [hostartifacts.dev/install.sh](https://hostartifacts.dev/install.sh) |
| REST API | Custom integrations and server-side automation | `/api/*` on the public web origin |
| MCP server | Cursor, Claude Code, and other MCP clients | `/mcp` with OAuth discovery on the web origin |

## Get Started

For most users, the fastest path is:

1. Install the CLI:

```bash
curl -fsSL https://hostartifacts.dev/install.sh | sh
```

2. Sign in from your machine:

```bash
artifacts login
```

3. Publish your first artifact:

```bash
artifacts push --project-slug default --file ./report.md
```

4. Open the hosted URL returned in the JSON response.
5. Update anytime — each push creates a new immutable version.

The full product docs live at [docs.hostartifacts.dev](https://docs.hostartifacts.dev).

## MCP Clients

The API exposes an MCP server at `/mcp` and OAuth discovery metadata on the public web origin.

For local development, configure MCP clients with:

- Server URL: `http://localhost:3000/mcp`
- Protected resource metadata: `http://localhost:3000/.well-known/oauth-protected-resource`
- Authorization server metadata: `http://localhost:3000/.well-known/oauth-authorization-server`

Standard clients dynamically register, complete browser consent, exchange the authorization code for a token, then call tools such as `get_current_principal`.

## Deployment

Artifacts runs as a Bun + Turborepo monorepo with a public Next.js web service and a private Hono API. Production uses external Neon Postgres and S3-compatible object storage (Cloudflare R2 by default).

Recommended shape on [Railway](https://railway.com):

| Service | Visibility | Purpose |
| --- | --- | --- |
| `web` | Public | Next.js app, API gateway, `/mcp`, OAuth, CLI target |
| `api` | Private | Hono API, billing cron, background jobs |

Canonical production origin: `https://hostartifacts.dev`. Docs live at `https://docs.hostartifacts.dev`.

For production, configure public URLs and secrets before exposing the deployment:

```bash
PUBLIC_APP_URL=https://hostartifacts.dev
BETTER_AUTH_URL=https://hostartifacts.dev
INTERNAL_API_URL=<private-api-url>
```

See [RAILWAY_DEPLOYMENT_PLAN.md](RAILWAY_DEPLOYMENT_PLAN.md) for domain setup, env sync, Google OAuth, billing cron, and production hardening.

## Local Development

Artifacts is a Turborepo monorepo with Bun, Next.js, Hono, Drizzle, PostgreSQL, S3-compatible storage, Tailwind CSS, and the MCP TypeScript SDK.

Requirements:

- Bun (matches the repo package manager)
- Node.js 24 or newer
- PostgreSQL
- S3-compatible storage
- Google OAuth credentials for interactive login

Install and set up the repo:

```bash
bun install
cp .env.example .env
bun run db:migrate
bun run dev
```

Copy `.env.example` to `.env` and align:

- `BETTER_AUTH_URL` and `PUBLIC_APP_URL` must match the browser-visible origin used for OAuth redirects (default `http://localhost:3000`).
- `INTERNAL_API_URL` should point at the Hono API (`http://127.0.0.1:3001` locally). Next.js rewrites `/api/*` there so cookies stay scoped to the web origin.

Common commands:

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the web and API apps through Turbo |
| `bun run dev:env-file` | Start dev using `.env` instead of Infisical |
| `bun run build` | Build the workspace |
| `bun run typecheck` | Run TypeScript project references |
| `bun run lint` | Run lint across packages |
| `bun run test` | Run package tests |
| `bun run cli:build` | Build the `artifacts` CLI |
| `bun run cli:install` | Install `artifacts` to `~/.local/bin` |
| `bun run docs:dev` | Start Mintlify docs locally on port 3002 |

Database commands:

| Command | Purpose |
| --- | --- |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Apply migrations |

Local CLI usage:

```bash
bun run cli:build
bun run cli:install
export AGENT_ARTIFACTS_BASE_URL="http://127.0.0.1:3001"

artifacts login
artifacts schema
artifacts push --project-slug default --file ./report.md
artifacts artifact list
```

Optional Playwright smoke specs live in `apps/web/e2e`. Start the dev servers first, install browsers once via `bunx playwright install`, then run `bun run --filter @agent-artifacts/web test:e2e`.

See [apps/cli/README.md](apps/cli/README.md) for CLI details.

## Repository Map

| Path | What lives there |
| --- | --- |
| `apps/web` | Next.js web app for marketing, dashboard, artifact viewer, sharing, and auth |
| `apps/api` | Hono API, MCP routes, billing cron, rate limits, and audit logging |
| `apps/cli` | `artifacts` CLI for agents — REST wrapper, JSON output, schema introspection |
| `packages/artifact` | Artifact services, versioning, share links, and repositories |
| `packages/auth` | API keys, agent auth, and credential services |
| `packages/billing` | Usage metering and Dodo Payments integration |
| `packages/db` | Drizzle schema, migrations, and database client |
| `packages/mcp` | MCP tool definitions and handlers |
| `packages/policy` | Authorization policy layer shared across surfaces |
| `packages/storage` | S3-compatible object storage access |
| `packages/workspace` | Workspaces, memberships, invitations, and audit events |
| `packages/access` | Role mapping and access evaluation |
| `packages/config` | Environment loading and validation |
| `packages/shared` | Shared utilities |
| `docs` | Mintlify product documentation |
| `scripts` | CLI install, env sync, and maintenance tooling |
| `skills/agent-artifacts` | Cursor skill for agent workflows |

The web app proxies `/api/*`, `/mcp`, and OAuth metadata to the private API so browser cookies stay scoped to the public origin.

## Observability

Operational logs ship to [Better Stack](https://betterstack.com/) when source tokens are configured. Without them, both apps still boot and log to stdout.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `BETTER_STACK_SOURCE_TOKEN` | API | Server-side API logs |
| `BETTER_STACK_WEB_SOURCE_TOKEN` | Web (server) | Next.js server-side logs |
| `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN` | Web (browser) | Browser logs via `/_betterstack` proxy |
| `ENABLE_BILLING_CRON` | API | Daily storage metering for paid accounts |
| `BILLING_CRON_SECRET` | API | Bearer token for manual billing snapshot endpoint |

Set `ENABLE_BILLING_CRON=true` on the **API service only — never the web service**. A Postgres advisory lock makes it safe when the API runs multiple replicas.

## Contributing

Artifacts is built in public. Issues, pull requests, design feedback, bug reports, and docs fixes are welcome.

- Open an issue or pull request on [GitHub](https://github.com/laxman-patel/agent-artifacts).
- Read the docs at [docs.hostartifacts.dev](https://docs.hostartifacts.dev) before changing user-facing behavior.
- See [PLAN.md](PLAN.md) and [ABOUT.md](ABOUT.md) for product context and goals.
