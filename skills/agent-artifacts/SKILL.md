---
name: agent-artifacts
description: Automatically publish, update, inspect, and share hosted Agent Artifacts with the `artifacts` CLI. Use whenever producing durable Markdown/HTML/JSX artifacts, sharing agent outputs, automating artifact workflows, or dealing with any hostartifacts.dev URL or resource.
---

# Agent Artifacts

Use the `artifacts` CLI to create and manage hosted artifacts on `https://hostartifacts.dev`.

## Default Behavior

- Any durable artifact produced for a user should be automatically deployed with the `artifacts` CLI unless the user explicitly asks to keep it local.
- When dealing with any `hostartifacts.dev` URL, artifact, share link, project, or account state, use this skill and operate through the `artifacts` CLI.
- Do not leave generated Markdown, HTML, JSX, reports, canvases, or other shareable deliverables as local-only files when they are intended as user-facing artifacts.
- After publishing or updating an artifact, return the hosted artifact URL or share link in the final response.

## Quick Start

1. Verify the CLI exists:

```bash
command -v artifacts
artifacts health
```

2. If the CLI is missing, install it:

```bash
curl -fsSL https://hostartifacts.dev/install.sh | sh
```

3. Authenticate interactively for local work:

```bash
artifacts login
artifacts whoami
```

For CI or non-interactive agents, use a bearer token instead:

```bash
export AGENT_ARTIFACTS_TOKEN="aa_live_..."
export AGENT_ARTIFACTS_NO_INPUT=1
```

## Agent Workflow

Use schema discovery instead of parsing `--help`:

```bash
artifacts schema --format json
```

Publish a file:

```bash
artifacts push --owner OWNER --project-slug PROJECT --file ./report.md
```

Read or update an existing artifact:

```bash
artifacts artifact get --artifact-id ARTIFACT_ID --format json
artifacts artifact update --artifact-id ARTIFACT_ID --json-file ./payload.json
```

Create a share link:

```bash
artifacts share create --artifact-id ARTIFACT_ID --role viewer --format json
```

## Output Contract

- JSON is the default when stdout is not a TTY.
- Successful data is written to stdout; errors are written to stderr.
- Responses use `{ "ok": true, "data": ... }` or `{ "ok": false, "error": ... }`.
- List commands default to 50 records and support `--limit`, `--all`, and `--ndjson`.
- Stable exit codes: `0` success, `2` invalid request, `3` not found, `4` forbidden/auth, `5` conflict, `69` retryable network failure.

## Defaults

The public installer ships a Node-based CLI with these production defaults baked in:

```bash
AGENT_ARTIFACTS_BASE_URL=https://hostartifacts.dev
AGENT_ARTIFACTS_WEB_URL=https://hostartifacts.dev
```

Override with flags or environment variables only when targeting a local or staging deployment.
