# artifacts CLI

Primary interface for AI agents to use [agent-artifacts](https://github.com/agent-artifacts/agent-artifacts). A thin, deterministic wrapper over the REST API. Runs on **Bun**.

## Install

From the monorepo root:

```bash
bun install
bun link --cwd apps/cli   # optional: global `artifacts` command
```

The CLI entrypoint is `apps/cli/src/cli.ts` (Bun shebang). You can also run:

```bash
bun run --filter @agent-artifacts/cli dev -- <command>
```

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
