# artifacts CLI

Primary interface for AI agents to use [agent-artifacts](https://github.com/agent-artifacts/agent-artifacts). A thin, deterministic wrapper over the REST API. Runs on **Bun**.

## Install

Published package:

```bash
npx @agent-artifacts/cli@latest setup
```

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

Like Firebase CLI, `artifacts login` opens your browser, completes Google sign-in on the web app, and stores credentials securely:

```bash
artifacts login
artifacts whoami
```

Bearer tokens are stored in the OS credential store: `secret-tool`/libsecret on Linux, Keychain on macOS, and Credential Manager on Windows. The file at `~/.config/agent-artifacts/credentials.json` contains only non-secret metadata such as URLs and profile hints.

On Linux, install `secret-tool` and make sure your keyring is unlocked before running `artifacts login`.

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

Returns JSON with every command, HTTP method/path, request body JSON Schema, examples, global flags (`--no-input`, `--dry-run`), and the stable output envelope contract.

For humans, bare `artifacts` prints the command index and each subcommand `--help` ends with copy-pasteable **Examples**.

### Non-interactive use

```bash
export AGENT_ARTIFACTS_NO_INPUT=1          # or pass --no-input on each invocation
export AGENT_ARTIFACTS_TOKEN="..."         # required when --no-input is set (no browser login)
artifacts whoami --format json
```

Publish a local artifact file without building the JSON payload by hand:

```bash
artifacts push --owner alice --project-slug default --file ./report.md
artifacts push --owner alice --project-slug default --file ./prototype.tsx --title "Prototype v1" --private
```

`push` infers `type`, `title`, and `slug` from `.md`, `.markdown`, `.html`, `.htm`, `.jsx`, and `.tsx` files. Override them with `--type`, `--title`, and `--slug` when the inferred values are not what you want.

Preview destructive or mutating calls without side effects:

```bash
artifacts artifact delete --artifact-id ARTIFACT_ID --dry-run
echo '{"content":"# v2"}' | artifacts artifact update --artifact-id ART_ID --json-file -
```

### Flag-only inputs

All command inputs are **named flags** — there are no positional arguments:

```bash
artifacts artifact get --artifact-id ARTIFACT_ID
artifacts share revoke --share-link-id SHARE_LINK_ID
artifacts path artifact --owner alice --project-slug default --slug readme
```

Missing required flags exit with code 2 and include a copy-pasteable example.

### Bounded list output

List commands default to **50 records** (max 100). Truncation hints go to stderr; pass `--all` for the full set:

```bash
artifacts artifact list --limit 20
artifacts audit list --artifact-id ARTIFACT_ID --all
```

## Output contract

Designed for non-interactive agent use (see [InfoQ: AI Agent Driven CLIs](https://www.infoq.com/articles/ai-agent-cli/)):

- **JSON by default** when stdout is not a TTY: `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "kind", "message" } }`
- **Text** when interactive (TTY): human-readable
- **Successful data on stdout**; **errors on stderr** in both text and JSON modes
- **`--ndjson`** on list commands streams one record per line for pipeline processing
- **Stable exit codes**: `0` ok, `2` invalid request, `3` not found, `4` forbidden/auth, `5` conflict, `69` network (retryable)
- **`next_actions`** after create/get with suggested follow-up commands

## Commands

| Command | API |
|---------|-----|
| `artifacts push --owner ... --project-slug ... --file ./report.md` | `POST /api/artifacts` |
| `artifacts login` | Browser OAuth via web app |
| `artifacts logout` | Clear local credentials |
| `artifacts whoami` | `GET /api/profile/me` |
| `artifacts profile get` | `GET /api/profile/me` |
| `artifacts project list` | `GET /api/profile/projects` |
| `artifacts project create --json '...'` | `POST /api/projects` |
| `artifacts artifact list` | `GET /api/profile/artifacts` (default `--limit 50`) |
| `artifacts artifact create --json '...'` | `POST /api/artifacts` |
| `artifacts artifact get --artifact-id <id>` | `GET /api/artifacts/:id` |
| `artifacts artifact content --artifact-id <id>` | `GET /api/artifacts/:id/content` |
| `artifacts artifact update --artifact-id <id> --json '...'` | `POST /api/artifacts/:id/versions` |
| `artifacts path artifact --owner ... --project-slug ... --slug ...` | `GET /api/by-path/...` |
| `artifacts share create --artifact-id <id> --json '...'` | `POST /api/artifacts/:id/share-links` |
| `artifacts audit list` | `GET /api/audit-events` (default `--limit 50`) |
| `artifacts health` | `GET /health` |

## Mutations

Pass full API payloads via `--json` or `--json-file` (use `-` for stdin):

```bash
artifacts artifact update --artifact-id ART_ID --json '{"content":"# v2","changelog":"edit"}'
echo '{"content":"# v2"}' | artifacts artifact update --artifact-id ART_ID --json-file -
```
