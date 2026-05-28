# Artifacts

> Hosted, versioned, access-controlled URLs for everything your agents produce.

## What it is

`agent-artifacts` (product name: **Artifacts**) is a hosting service for the rich outputs agents now generate — HTML reports, Markdown specs, JSX/Preact prototypes. Every artifact gets:

- A permanent URL: `agent-artifacts.com/{user}/{slug}`
- Immutable, monotonically-numbered versions with diff + restore
- Access controls: public, private, email allowlist, scoped share links
- Three equal surfaces: **web UI**, **REST API**, **MCP server** (so agents and humans hit the same model + same authorization)

Think *GitHub Gist × Vercel Preview × Google Docs sharing × Git history*, MCP-native.

## Why it exists

Agents stopped producing chat replies and started producing artifacts. After Thariq's "unreasonable effectiveness of HTML" piece (May 2026, 8M views on X), the Claude Code crowd shifted defaults away from Markdown walls toward HTML reports, JSX prototypes, interactive explainers. Karpathy boosted the same idea: vision is the preferred output channel from models.

Problem: those artifacts have nowhere to live. They sit in `/tmp`, in chat-log attachments, in scratch dirs that get nuked. Sharing means uploading to S3 by hand. Version history doesn't exist. Access control doesn't exist.

Theo flagged the gap directly in his reaction video — *"There's evidently an opportunity for a microservice for this, by the way. Wink."* This is that microservice.

## How it's useful

For agents:

- One CLI call (`agent-artifacts push ./out`) or one MCP tool call → durable URL back
- Updates create new immutable versions; agents can diff/restore/fork programmatically
- Scoped credentials — agents can't silently exfiltrate or escalate

For humans:

- Open the URL anywhere, render in a sandboxed iframe (HTML), sanitized Markdown, or built Preact (JSX)
- Inspect history, compare versions, roll back, restrict access — same surface agents use
- Hand the URL to a teammate or PM instead of "the file in my Downloads"

Concrete uses lifted straight from the transcript: design exploration grids, PR review writeups, weekly status reports for leadership, throwaway HTML editors for one-off data, research synthesis pages, interactive explainers with sliders/knobs.

## Core primitives

- **Artifact** — stable logical object, one owner, one slug, one type
- **Version** — immutable content snapshot, content-hashed, parent-linked
- **Principal** — every actor (user, agent, API key, share link) goes through the same policy layer
- **Access policy** — view/edit modeled independently; deny by default; same enforcement on web/API/MCP

## Stack

Bun + Turborepo monorepo · Next.js (web) · Hono (API) · MCP TypeScript SDK · `better-auth` (Google OAuth + API keys + MCP auth) · NeonDB Postgres + Drizzle · S3-compatible object storage (R2 default) · Preact runtime for JSX with `react`/`react-dom` aliased to `preact/compat` · client-side rendering for all artifact types · Better Stack for observability.

## Sources

- [Using Claude Code: The unreasonable effectiveness of HTML — Anthropic](https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html)
- [Simon Willison's commentary](https://simonwillison.net/2026/May/8/unreasonable-effectiveness-of-html/)
- [HN discussion](https://news.ycombinator.com/item?id=48071940)
- `video-transcript-premise.txt` (Theo's reaction video, in repo)
- `PLAN.md` (full product spec, in repo)
