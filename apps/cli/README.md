# artifacts CLI

Primary interface for AI agents to use [agent-artifacts](https://github.com/agent-artifacts/agent-artifacts). A thin, deterministic wrapper over the REST API. Runs on **Bun**.

## Install

From the monorepo root:

```bash
bun install
bun run cli:build
bun run cli:install   # symlinks `artifacts` into ~/.local/bin (ensure that dir is on your PATH)
```

After install, run `artifacts` from anywhere. Without installing globally:

```bash
bun run artifacts -- <command>          # from repo root (uses built dist/cli.js)
./apps/cli/dist/cli.js <command>      # direct path after cli:build
bun run --filter @agent-artifacts/cli dev -- <command>  # run from TypeScript source
```

Rebuild after CLI code changes: `bun run cli:build`.

### Production bundle (URLs baked in)

Ship a standalone binary with your deployed API and web URLs as defaults. The build reads the repo **`.env`** file automatically (same vars as the web app):

| Baked into CLI | From `.env` (first match wins) |
|----------------|--------------------------------|
| API base URL | `AGENT_ARTIFACTS_BASE_URL` or `INTERNAL_API_URL` |
| Web URL (browser login) | `AGENT_ARTIFACTS_WEB_URL` or `PUBLIC_APP_URL` or `NEXT_PUBLIC_APP_URL` or `BETTER_AUTH_URL` |

Set production values in `.env`, then:

```bash
bun run cli:build:prod
```

Output: `apps/cli/dist/artifacts` — a compiled Bun binary. Install globally:

```bash
bun run cli:install:prod
```

Users can still override URLs with env vars, flags, or by running `artifacts login` against another environment. Resolution order: flags → env → saved credentials → **build-time defaults**.

Dev builds (`cli:build`) keep localhost defaults.

## Authentication

### Browser login (recommended)

Like Firebase CLI, `artifacts login` opens your browser, completes Google sign-in on the web app, and stores credentials locally:

```bash
artifacts login
artifacts whoami
```

Credentials are saved to `~/.config/agent-artifacts/credentials.json` (mode `0600`).

Override defaults if needed:

```bash
export AGENT_ARTIFACTS_BASE_URL="http://127.0.0.1:3001"
export AGENT_ARTIFACTS_WEB_URL="http://localhost:3000"
artifacts login
```

Sign out:

```bash
artifacts logout
```

### Manual token (CI / automation)

```bash
export AGENT_ARTIFACTS_BASE_URL="http://127.0.0.1:3001"
export AGENT_ARTIFACTS_TOKEN="your-bearer-token"
```

Bearer auth skips CSRF checks on the API.

## Agent discovery

Agents should **not** parse `--help`. Use the schema command:

```bash
artifacts schema
```

Returns JSON with every command, HTTP method/path, request body JSON Schema, examples, and the stable output envelope contract.

## Output contract

Designed for non-interactive agent use (see [InfoQ: AI Agent Driven CLIs](https://www.infoq.com/articles/ai-agent-cli/)):

- **JSON by default** when stdout is not a TTY: `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "kind", "message" } }`
- **Text** when interactive (TTY): human-readable; errors on stderr
- Data only on stdout; diagnostics on stderr
- **Stable exit codes**: `0` ok, `2` invalid request, `3` not found, `4` forbidden/auth, `5` conflict
- **`next_actions`** after create/get with suggested follow-up commands

## Commands

| Command | API |
|---------|-----|
| `artifacts login` | Browser OAuth via web app |
| `artifacts logout` | Clear local credentials |
| `artifacts whoami` | `GET /api/profile/me` |
| `artifacts profile get` | `GET /api/profile/me` |
| `artifacts project list` | `GET /api/profile/projects` |
| `artifacts project create --json '...'` | `POST /api/projects` |
| `artifacts artifact list` | `GET /api/profile/artifacts` |
| `artifacts artifact create --json '...'` | `POST /api/artifacts` |
| `artifacts artifact get <id>` | `GET /api/artifacts/:id` |
| `artifacts artifact content <id>` | `GET /api/artifacts/:id/content` |
| `artifacts artifact update <id> --json '...'` | `POST /api/artifacts/:id/versions` |
| `artifacts path artifact <owner> <project> <slug>` | `GET /api/by-path/...` |
| `artifacts share create <id> --json '...'` | `POST /api/artifacts/:id/share-links` |
| `artifacts audit list` | `GET /api/audit-events` |
| `artifacts health` | `GET /health` |

## Mutations

Pass full API payloads via `--json` or `--json-file`:

```bash
artifacts artifact update ART_ID --json '{"content":"# v2","changelog":"edit"}'
```
