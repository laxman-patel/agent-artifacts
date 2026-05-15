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
