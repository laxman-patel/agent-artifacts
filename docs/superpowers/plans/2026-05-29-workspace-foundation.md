# Workspace Foundation Implementation Plan

> **Tracking issue:** [#3 — PRD: Complete Team Plan Workspaces and Seat Billing](https://github.com/laxman-patel/agent-artifacts/issues/3)

**Branch:** `feat/workspace-foundation`

**Billing:** All Dodo checkout, webhooks, entitlements, and usage metering live on `dodo-billing-integration`. This branch only adds workspace roles (`billing_admin`, `workspace.manage_billing`) as permission hooks for that branch to wire later.

---

## Completed on this branch

- [x] Workspace schema + migrations (`0008`–`0010`, `0012`)
- [x] `@agent-artifacts/workspace` — access, CRUD, invitations, membership
- [x] Personal workspace bootstrap on username claim
- [x] Workspace API routes (no payment routes)
- [x] Namespace-aware artifact access with workspace role inheritance
- [x] Workspace-scoped project/artifact listing and creation
- [x] Web UI — switcher, team dashboard, settings, invite accept
- [x] CLI `--workspace` flag + MCP workspace tools
- [x] Workspace-scoped audit events

## Deferred to `dodo-billing-integration`

- [ ] Workspace-scoped Studio checkout and billing portal
- [ ] Seat accounting and enforcement on invite
- [ ] Usage metering by workspace billable subject
- [ ] Dodo webhook reconciliation for team subscriptions

## Follow-ups (workspace-only)

- [ ] Project transfer from personal to team workspace
- [ ] Workspace URLs for team artifacts (`/w/{slug}/...` rendering)
- [ ] Member listing with profile enrichment (email/name vs raw userId)

## Merge note

When merging with `dodo-billing-integration`, resolve migration numbering (`0008_billing_foundation` vs `0008_workspaces`) and extend `billing_accounts` for workspace subjects rather than reintroducing a separate billable-accounts table.
