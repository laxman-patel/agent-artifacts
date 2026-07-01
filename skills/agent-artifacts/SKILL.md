---
name: agent-artifacts
description: Automatically publish, update, inspect, and share hosted Agent Artifacts with the `artifacts` CLI. Use whenever producing durable Markdown/HTML/JSX artifacts, sharing agent outputs, automating artifact workflows, or dealing with any hostartifacts.dev URL or resource.
---

# Agent Artifacts

Publish and manage hosted artifacts on `https://hostartifacts.dev` with the `artifacts` CLI.

## When to use

- Any durable deliverable (Markdown, HTML, JSX, reports, canvases, dashboards) should be published, not left as a local-only file — unless the user explicitly asks to keep it local.
- Any `hostartifacts.dev` URL, artifact, share link, project, or account operation goes through this CLI.
- After publishing or updating, return the hosted artifact URL (or share link) in your final response.

## Publish in one command

Just run the action — do not run preflight checks first. `--owner`, `--slug`, `--title`, and `--type` are all inferred, and slug conflicts auto-resolve with a numeric suffix. The JSON response carries `data.url` and `next_actions`; read the URL from there.

```bash
artifacts push --project-slug default --file ./report.md
```

Useful options: `--title`, `--description`, `--changelog`, `--slug`, `--private`, `--public-edit`, and `--owner` (only when publishing into another account you can access).

There is no need to run `health`, `status`, `whoami`, or `schema` before pushing. The push either succeeds or returns a machine-readable error with a stable exit code — diagnose only on failure.

## When a command fails

Every failure prints `{ "ok": false, "error": { "kind", "message" }, "next_actions": [...] }` to stderr and sets a stable exit code. Branch on the exit code:

| Exit | Meaning | What to do |
| ---- | ------- | ---------- |
| `2` | invalid request | Fix the flag/body named in `error.message`; run `artifacts schema` if unsure which flags exist |
| `3` | not found | Check the id / slug / owner you passed |
| `4` | forbidden / not signed in | Authenticate (see below) |
| `5` | conflict | Slug taken — `push` retries automatically; for `artifact create` pass `--ensure` |
| `69` | network | Transient — retry; confirm `--base-url` |
| command not found | CLI not installed | Install it (see below) |

For a single-command diagnosis of auth, reachability, and identity, run:

```bash
artifacts doctor   # one JSON report: cli.version, auth, api.reachable, identity, healthy
```

`doctor` never throws for an expected problem — it always returns a report describing what is wrong and the next action to take.

## Authentication

Credentials persist across runs, so you normally authenticate once. Only needed after an exit `4`.

Interactive (local machine):

```bash
artifacts login   # saves a 0600 token at ~/.config/agent-artifacts/credentials.json
```

Non-interactive (CI or agents) — an API key (`aa_k_...`), an agent access token, or a login bearer token all work in the same `Authorization: Bearer` header:

```bash
export AGENT_ARTIFACTS_TOKEN="aa_k_..."
export AGENT_ARTIFACTS_NO_INPUT=1
```

Any credential resolves its own identity, so you never need the owner username out of band — `push` infers it, and `artifacts whoami --format json` prints it (`data.profile.username`).

## Install (only if `artifacts` is not found)

```bash
curl -fsSL https://hostartifacts.dev/install.sh | sh
```

## Other operations

```bash
artifacts artifact get --artifact-id ID --format json          # read metadata
artifacts artifact update --artifact-id ID --json-file ./payload.json
artifacts share create --artifact-id ID --role viewer --format json
artifacts artifact list                                        # 50/page; --limit, --all, --ndjson
```

## Discovery

`artifacts schema` is the machine-readable catalog — every command with its flags, JSON body schemas, global flags, and exit codes. It is a single JSON object: read it whole, do not truncate it. Use `artifacts schema --compact` for a slimmer catalog (command names, required flags, and examples only). Never parse `--help`.

## Output contract

- JSON is the default when stdout is not a TTY. Successful data goes to stdout; errors to stderr.
- Envelopes: `{ "ok": true, "data": ..., "next_actions": [...] }` or `{ "ok": false, "error": { "kind", "message" }, "next_actions": [...] }`.
- Production URLs are baked in (`https://hostartifacts.dev`). Override `--base-url` / `--web-url` (or the matching env vars) only when targeting a local or staging deployment.
