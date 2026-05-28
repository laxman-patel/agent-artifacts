# Workspace Foundation Implementation Plan

> **Tracking issue:** [#3 — PRD: Complete Team Plan Workspaces and Seat Billing](https://github.com/laxman-patel/agent-artifacts/issues/3)

**Branch:** `feat/workspace-foundation`

## Completed

- [x] Workspace schema + migrations (`0008`–`0012`)
- [x] `@agent-artifacts/workspace` — access, CRUD, invitations, membership
- [x] Personal workspace bootstrap on username claim
- [x] Workspace API routes
- [x] Namespace-aware artifact access with workspace role inheritance
- [x] Workspace-scoped project/artifact listing and creation
- [x] Web UI — switcher, team dashboard, settings, invite accept
- [x] `@agent-artifacts/billing` — billable subjects, seat accounting, checkout stub
- [x] CLI `--workspace` flag + MCP workspace tools
- [x] Workspace-scoped audit events

## Follow-ups (out of initial slices)

- [ ] Dodo webhook reconciliation to workspace billable accounts
- [ ] Seat enforcement on invite accept when at limit
- [ ] Project transfer from personal to team workspace
- [ ] Workspace URLs for team artifacts (`/w/{slug}/...` rendering)
- [ ] Member listing with profile enrichment (email/name vs raw userId)
- [ ] Usage metering (storage, delivery, version writes) by billable subject
