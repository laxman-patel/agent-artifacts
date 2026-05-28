# Workspace Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace user-only ownership with a workspace-aware namespace model while preserving existing personal URLs and data, as the foundation for Studio team billing.

**Architecture:** Introduce `workspaces`, `workspace_members`, and `workspace_invitations` tables. Personal namespaces map to implicit personal workspaces (slug = username). A dedicated `@agent-artifacts/workspace` package owns membership resolution, role policy, and workspace CRUD. Artifact/project access continues through `@agent-artifacts/access` during transition; workspace roles will extend namespace checks in a follow-up slice.

**Tech Stack:** Bun, Drizzle ORM, PostgreSQL, Hono API, Vitest

**Branch:** `feat/workspace-foundation`

**Tracking issue:** [#3 — PRD: Complete Team Plan Workspaces and Seat Billing](https://github.com/laxman-patel/agent-artifacts/issues/3)

---

## Completed (this branch)

- [x] Workspace schema + migrations (`0008_workspaces`, `0009_backfill_personal_workspaces`)
- [x] `@agent-artifacts/workspace` package (policy, access, service, repository)
- [x] Shared workspace types and URL helpers
- [x] Personal workspace bootstrap on username claim
- [x] Workspace API routes (list, create, get, members, slug availability)

## Next slices

### Slice 2: Invitations

**Files:**
- Create: `packages/workspace/src/invitation-service.ts`
- Modify: `packages/workspace/src/index.ts`
- Create: `apps/api/src/routes/workspace-invitations.ts`
- Test: `packages/workspace/tests/invitation-service.test.ts`

- [ ] Invite by email with token, expiry, role
- [ ] Accept / revoke / resend flows
- [ ] API routes for invitation management

### Slice 3: Membership management

- [ ] Change roles, remove members, at-least-one-owner invariant
- [ ] Member listing with user profile enrichment

### Slice 4: Namespace-aware project/artifact ownership

- [ ] Extend access resolver with workspace membership inheritance
- [ ] Create projects/artifacts in workspace context
- [ ] Workspace-scoped listing

### Slice 5: Web UI

- [ ] Workspace switcher in app shell
- [ ] Team dashboard, member settings, invitation flows

### Slice 6: Workspace billing (Dodo)

- [ ] Billable subject model
- [ ] Studio checkout scoped to workspace
- [ ] Seat accounting and additional seats

### Slice 7: CLI / MCP

- [ ] `--workspace` flag and workspace listing tools

### Slice 8: Audit + usage

- [ ] Workspace-scoped audit events
- [ ] Usage metering by billable subject
