# agent-artifacts CLI (`aa`)

Primary interface for AI agents to use [agent-artifacts](https://github.com/agent-artifacts/agent-artifacts). Mirrors every MCP tool and the REST API.

## Install

From the monorepo root:

```bash
bun install
bun run --filter @agent-artifacts/cli build
```

Link globally (optional):

```bash
cd apps/cli && bun link
```

## Authentication

```bash
export AGENT_ARTIFACTS_BASE_URL="http://127.0.0.1:3001"
export AGENT_ARTIFACTS_TOKEN="your-bearer-token"
```

Bearer auth skips CSRF checks on the API (same as MCP clients).

## Agent discovery

Agents should **not** parse `--help`. Use the schema command:

```bash
aa schema
```

Returns JSON with every command, HTTP mapping, MCP tool name, input JSON Schema, and examples.

## Output contract

- **JSON** (default when stdout is not a TTY): `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "kind", "message" } }`
- **Text** (interactive TTY): human-readable; errors on stderr
- Data only on stdout; diagnostics on stderr
- Exit codes: `0` ok, `2` invalid request, `3` not found, `4` forbidden/auth, `5` conflict

## MCP parity (`invoke`)

Run any MCP tool by name:

```bash
aa invoke list_artifacts
aa invoke create_artifact --json '{"ownerUsername":"alice","projectSlug":"default","slug":"demo","type":"markdown","title":"Demo","content":"# Hi"}'
```

## Resource commands

| Command | MCP tool |
|---------|----------|
| `aa principal get` | `get_current_principal` |
| `aa project list` | `list_projects` |
| `aa project create --json '...'` | `create_project` |
| `aa artifact list` | `list_artifacts` |
| `aa artifact create --json '...'` | `create_artifact` |
| `aa artifact get <id>` | `get_artifact` |
| `aa artifact content <id>` | `get_artifact_content` |

API-only: `aa profile set-username`, `aa path project`, `aa share create`, `aa audit list`, `aa health`.

## Mutations

Pass full API/MCP payloads via `--json` or `--json-file`:

```bash
aa artifact update ART_ID --json '{"content":"# v2","changelog":"edit"}'
```
