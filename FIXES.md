# Remediation Plan

Audit date: 2026-06-10, `main @ 911bc45`. Produced from four parallel code audits (API↔consumer parity, web routes, domain packages/billing, CLI/MCP parity) plus direct verification.

## How to use this document

- Work phases in order: **Phase 0 → 1 → 2 → 3 → 4**. Items within a phase are independent unless a dependency is noted.
- Each item has **Problem / Evidence / Fix / Acceptance**. Line numbers were correct at audit time; re-verify before editing, the code may have drifted.
- Items marked **DECISION** involve a product choice. A recommended default is given so you can proceed autonomously; if you deviate, record why in the commit message.
- After every item: `bun run typecheck` from the repo root must pass. Run package tests for whatever you touched (`bun run --filter @agent-artifacts/<pkg> test`). Commit per item with a focused message.
- Conventions: no inline imports (imports at top of module); exhaustive `switch` over unions with a `never` default case.

---

## Phase 0 — Broken production paths (fix first)

### 0.1 Share links to restricted artifacts fail end-to-end

Two independent bugs; fix both.

**Problem A:** `/share/[token]` sets a cookie during a Server Component render. Next 16 only allows `cookies().set()` in Server Actions / Route Handlers, so redemption throws before the redirect.

**Evidence:** `apps/web/app/share/[token]/page.tsx:46-55` (cookie write + redirect in a page).

**Fix A:** Convert the page to a Route Handler: delete `page.tsx`, create `apps/web/app/share/[token]/route.ts` with a `GET` handler that resolves the token against `${internalApiOrigin()}/api/share/{token}`, sets the `aa_share_{artifactId}` cookie on the response, and returns a redirect to the artifact path. Preserve the 404/410 → `notFound()` behavior (return 404 response).

**Problem B:** Even with the cookie set, the page gate ignores it. Share grants only attach when the API route has an `:artifactId` param (`resolveShareGrantPrincipal` reads `c.req.param("artifactId")`), but the page gate calls `GET /api/by-path/:username/:projectSlug/:slug`, which has none — so a restricted artifact still 403s for a valid share-cookie holder.

**Evidence:** `apps/api/src/http/principal.ts:54-72`; gate path `apps/web/lib/server-api.ts:204-214` → `apps/api/src/routes/profile.ts:70-82`.

**Fix B:** In the by-path artifact handler (`routes/profile.ts`), after resolving the artifact id but before authorization, check for an `aa_share_{artifactId}` cookie and, if present, resolve it through `ShareLinkService.resolveCookieGrant` and merge the grant into the principal's `artifactRoleGrants` (reuse the same logic as `resolveShareGrantPrincipal`; extract a shared helper that takes an explicit artifact id instead of reading route params).

**Acceptance:** With a restricted artifact (publicView=false): create a viewer share link, open `/share/{token}` in a clean anonymous browser session → lands on the artifact page and the content renders. Revoke the link → reload → restricted view returns. Add a Playwright spec for this flow in `apps/web/e2e/`.

### 0.2 MCP authentication is impossible

**Problem:** `tools/call` always returns `-32001 Authentication required` and no token is obtainable. Three breaks: (1) the better-auth `mcp` plugin has no backing tables — the drizzle adapter registers only `user/session/account/verification` and the schema has no `oauth_application` / `oauth_access_token` / `oauth_consent`; (2) OAuth discovery 404s on the web origin — `/.well-known/oauth-protected-resource` exists only on the API origin and the web rewrites only `/api/:path*` and `/mcp`; (3) better-auth serves AS metadata at `/api/auth/.well-known/oauth-authorization-server`, not the RFC 8414 root location clients probe.

**Evidence:** `packages/auth/src/index.ts:44-52,64-66`; `packages/db/src/schema.ts` (no oauth tables); `apps/api/src/routes/index.ts:31-38`; `apps/web/next.config.ts:61-74`; `apps/api/src/http/mcp.ts:142`.

**Fix:**
1. Add the better-auth MCP plugin's required tables to `packages/db/src/schema.ts` (use `npx @better-auth/cli generate` output as reference for `oauth_application`, `oauth_access_token`, `oauth_consent`), create a drizzle migration, and register the models in the adapter schema map in `packages/auth/src/index.ts`.
2. Add Next rewrites for `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` on the web origin: protected-resource → API's endpoint; authorization-server → API `/api/auth/.well-known/oauth-authorization-server` (or re-serve at root on the API and rewrite to that). Ensure the `WWW-Authenticate` header URL in 401 responses points to a URL that actually resolves.
3. Verify the full flow with MCP Inspector (`npx @modelcontextprotocol/inspector`) against the local stack: dynamic client registration → consent → token → `tools/call get_current_principal` succeeds.

**Acceptance:** A standard MCP client can complete OAuth and successfully call `create_artifact` end-to-end on a dev stack. Document the connection steps in `README.md`.

### 0.3 Advertised setup command does not exist

**Problem:** The landing page hard-codes `npx agent-artifacts@latest setup` (rendered twice). There is no `setup` command in the CLI, the package is `@agent-artifacts/cli` with `"private": true`, and the bare npm name `agent-artifacts` is unclaimed — an onboarding dead end and a supply-chain risk (name squatting).

**Evidence:** `apps/web/app/page.tsx:9` (rendered at ~423 and ~553); `apps/cli/src/commands/index.ts:27-55` (no setup); `apps/cli/package.json:2-4`.

**Fix (DECISION, recommended default):**
1. Implement `artifacts setup` in the CLI: runs `login` if no credentials, prints the artifact base URL, and emits ready-to-paste MCP client config (server URL + instructions). Register it in `commands/index.ts`.
2. Prepare the package for publication under the name the marketing copy uses (or change the copy to the real name): set `name`, remove `private`, add `bin`, verify `npx` execution path. **At minimum, claim the npm name immediately** even with a stub release, to close the squatting hole.
3. Whatever the final command string is, update `apps/web/app/page.tsx:9` and the e2e assertion `apps/web/e2e/smoke.spec.ts:7` to match exactly.

**Acceptance:** The exact command shown on the landing page works on a clean machine (or the copy is changed to a command that does).

### 0.4 Hard-coded session cookie name breaks production HTTPS

**Problem:** `better-auth.session_token` is read literally in three places, but better-auth prefixes cookies with `__Secure-` when the auth base URL is https. In production: CLI authorize 401s, the CLI login page loops to `/login`, and `/dashboard`/`/settings` proxy gating bounces signed-in users.

**Evidence:** `apps/api/src/routes/cli.ts:25`, `apps/web/app/cli/login/page.tsx:39`, `apps/web/proxy.ts:15`.

**Fix:** Create one shared helper (e.g. in `packages/shared`): `readSessionCookie(cookies)` that checks `__Secure-better-auth.session_token` then `better-auth.session_token` (or derive the exact name from better-auth config if exposed). Replace all three literal reads.

**Acceptance:** Unit test the helper with both cookie names. Manually verify the CLI login flow still works in dev (http) and that the proxy logic uses the helper.

### 0.5 CLI `artifact update` rejects its own documented usage

**Problem:** The command validates the body with `updateArtifactInputSchema`, which requires `artifactId`, but `--artifact-id` is never merged into the body before parsing (the API route merges the path param; the CLI does not). The command's own example and both README examples exit 2 with a Zod error. Dry-run tests bypass schema parsing, so tests pass.

**Evidence:** `apps/cli/src/commands/artifact.ts:90-110` (example at :101); `apps/cli/src/register-commands.ts:55-61`; `packages/artifact/src/artifact-types.ts:44-49`; cf. API merge at `apps/api/src/routes/artifacts.ts:64-67`; `apps/cli/tests/dry-run.test.ts:21-28`.

**Fix:** In the update command (or `register-commands.ts` pre-parse hook), merge `{ artifactId: opts.artifactId }` into the JSON body before schema validation. Add a non-dry-run test that exercises the schema parse with `--json '{"content":"# x"}'` + `--artifact-id`.

**Acceptance:** The README examples (`apps/cli/README.md:159,170-171`) run successfully against a dev stack.

---

## Phase 1 — Capabilities modeled but unreachable

### 1.1 Editor role exists, but nothing can edit (DECISION)

**Problem:** `publicEdit` and editor share links are settable in three UIs, the policy table grants `artifact.update` to editors, but: (a) no surface has an editing UI; (b) `POST /api/artifacts/:id/versions` uses `requirePrincipal`, so anonymous editing is impossible even though the settings form says "Public edit (anonymous editors allowed, use carefully)"; (c) editor share-link grants only attach to browser cookie requests, which nothing exercises.

**Evidence:** `apps/web/app/components/access-settings-form.tsx:57`; `apps/api/src/routes/artifacts.ts:61-63`; `apps/api/src/http/principal.ts:99-105`; policy `packages/policy/src/index.ts:19`.

**Fix (recommended default):**
1. **Drop the anonymous-edit promise.** Change the copy to "Public edit (any signed-in user can edit)". Keep `requirePrincipal`.
2. **Build a minimal web edit surface:** a "New version" action on the artifact page (visible when the resolved role is editor or higher): textarea or file upload + optional changelog → `POST /api/artifacts/:id/versions`. Reuse the workbench visual vocabulary from `artifact-control-menu.tsx`. Surface it in the artifact menu next to Versions.
3. Verify an editor **share-link** holder (signed in or not, per the decision above) can use that surface: the grant cookie applies on `/api/artifacts/:id/*` routes, so the version POST will honor it once the page exposes the action. If staying signed-in-only, the share page should prompt sign-in for editor links.

**Acceptance:** Owner enables publicEdit → a second signed-in user opens the artifact and publishes a new version from the web. Editor share link grants the same. Viewer-only users never see the action.

### 1.2 Version restore is promised but unimplemented; archive/fork are dead actions

**Problem:** `artifact.restore` exists in the action vocabulary, the policy table, and is promised in `ABOUT.md` ("diff + restore") and `PLAN.md`, but there is no endpoint, MCP tool, CLI command, or UI. `artifact.archive` and `artifact.fork` are likewise policy-only.

**Evidence:** `packages/shared/src/index.ts:35`; `packages/policy/src/index.ts:20-23,36`.

**Fix:**
1. Implement restore as "create a new version from an old one": `POST /api/artifacts/:artifactId/versions/:versionNumber/restore` → service method that reads version N's content and writes it as a new head version (audit event `artifact.version_restored`, changelog `Restored from v{N}`). Enforce `artifact.restore` policy.
2. Expose it: web (button on the history page rows + the menu's version list), CLI (`artifact restore --artifact-id --version`), MCP (`restore_artifact_version`).
3. Remove `artifact.archive` and `artifact.fork` from the policy/action tables until they are designed (they mislead readers of the authz model). Keep `archived` enum values in the DB only if a migration would be disruptive; otherwise drop them too.

**Acceptance:** Restoring v1 of a 3-version artifact produces v4 with v1's content on all three surfaces; audit log records it.

### 1.3 Team invitations (and viewer grants) are undeliverable

**Problem:** The API generates `acceptUrl = {app}/team-invite/{token}` but there is no mailer anywhere in the repo, and the UI discards the response ("Invitation sent."). The invitee can never obtain the link through the product. Same for `viewerEmails` grants — no notification at all.

**Evidence:** `packages/workspace/src/invitation-service.ts:141-143,237-241,362-366`; `apps/web/app/components/workspace-invite-form.tsx:21-36`; `workspace-invitation-actions.tsx` (resend also discards `acceptUrl`).

**Fix (recommended default — ship the link, mailer later):**
1. After create and resend, render the returned `acceptUrl` in the UI with a copy button and "Send this link to the invitee" helper text (mirror the one-time share-link URL pattern in `artifact-controls.tsx`).
2. Show pending invitations with a "Copy invite link" affordance if the API can re-derive it; if tokens are hashed and unrecoverable, only offer copy at create/resend time and say so.
3. (Optional, separate item) Integrate a mailer (e.g. Resend) behind `MAIL_*` env vars for both team invites and viewer-email grants; no-op with a logged warning when unconfigured.

**Acceptance:** A team admin can invite someone and hand them a working accept link without leaving the product.

### 1.4 Agent/API-key principal model is fiction (DECISION)

**Problem:** Principal types `agent`/`api_key`/`oauth_client`, the `AgentScope` model, and `account.manage_api_keys`/`manage_agents` actions all exist, but no auth path produces anything except `user` and anonymous `service`; the `api_keys` table was dropped in migration `0002`; `hasScope` returns `true` for every user principal, so scopes bound nothing. Meanwhile the CLI credential is the user's **raw session token** (full authority, no scoping, revocation only via session expiry, `logout` is local-only), and the CLI auth-code store is an in-memory `Map` that breaks on multi-instance deployments.

**Evidence:** `packages/shared/src/index.ts:17,43-58`; `packages/policy/src/index.ts:28-29,76-78`; `packages/db/drizzle/0002_secret_patch.sql:2`; `packages/db/src/schema.ts:111-115`; `packages/auth/src/index.ts:71-78`; `apps/api/src/cli-auth.ts:10-11`; `apps/cli/src/auth/credentials.ts:43-54`.

**Fix (recommended default — implement minimal API keys; this is the product's "agent-native" promise):**
1. New `api_keys` table: id, user_id, name, hashed key, scopes (jsonb), created_at, last_used_at, revoked_at. Migration + repo.
2. Auth path: accept `Authorization: Bearer aa_k_...` keys (distinguish by prefix from session bearers), resolve to a principal `{ type: "api_key", scopes }`. Make `hasScope` actually check scopes for non-user principals and **stop returning true unconditionally for users only if** sessions are meant to be all-powerful (document this in `packages/policy`).
3. Management surfaces: web `/settings/keys` (create/reveal-once/revoke, list with last-used), CLI `keys create|list|revoke`. Enforce `account.manage_api_keys` policy.
4. Switch CLI login to mint an API key instead of copying the session token (keep `--token` env support). Make `artifacts logout` revoke server-side.
5. Move the CLI auth-code store from the in-memory `Map` to the DB (the `verification` table fits) so multi-process deployments work.

If de-scoping instead: delete the agent/api_key/scope vocabulary from `shared`/`policy`/`schema` comments so the authz model tells the truth, and document that CLI = full user session.

**Acceptance:** An agent can be issued a scoped key that can create artifacts but cannot delete them; revoking the key kills access immediately; CLI login/logout lifecycle works server-side.

### 1.5 CLI and MCP lack team, share-link, and audit capability

**Problem:** The product promise is "one shared authorization model across web, CLI, REST, and MCP" with agents as first-class users, but: MCP has no share-link tools, no audit tool, no workspace/team tools, no by-path resolver; CLI has zero workspace commands (members, invitations, workspace audit). Agents cannot share what they publish or read audit logs.

**Evidence:** `packages/mcp/src/index.ts:28-146` (15 tools, none of the above); `apps/cli/src/commands/index.ts:27-55`.

**Fix:**
1. MCP tools (call the same services the REST routes use): `create_share_link`, `list_share_links`, `revoke_share_link`, `list_audit_events`, `resolve_path`, `list_workspaces`, `list_workspace_artifacts`.
2. CLI commands: `workspace list`, `workspace members`, `workspace invite|revoke-invite`, `workspace audit`.
3. Align input shapes across surfaces where cheap: MCP `set_artifact_access` nests `{ artifactId, access: {...} }` while REST takes a flat body; flatten the MCP input (or document the difference in tool descriptions). Same for `version` vs `versionNumber`.

**Acceptance:** An MCP agent can publish an artifact, create a viewer share link, and read its own audit trail without a human touching the web UI.

### 1.6 Web cannot create projects or publish versions

**Problem:** The dashboard's create-artifact form literally says "Create a project from the CLI or MCP before adding artifacts here"; there is no web project creation and no web version publishing (see 1.1). A brand-new web-only user cannot reach their first artifact in a custom project.

**Evidence:** `apps/web/app/dashboard/components/create-artifact-form.tsx:81`; no web consumer of `POST /api/projects` or `POST /api/artifacts/:id/versions`.

**Fix:** Add an inline "New project" affordance in the create-artifact form (and/or the project browser): name/slug fields → `POST /api/projects` (CLI/MCP already use it; it supports team slugs via `requireWorkspaceBySlug`). On success, select the new project in the form. Version publishing is covered by 1.1.

**Acceptance:** A fresh user can sign up, create a project, and publish an artifact entirely in the browser.

---

## Phase 2 — Billing and enforcement gaps

### 2.1 Team seats are never enforced

**Problem:** `includedSeats` and the $3/extra-seat product config exist, but invitation create/accept and member routes never consult billing; creating a team workspace requires no plan at all. Free users get unlimited teams and members; the seat product is dead config.

**Evidence:** `packages/billing/src/index.ts:108,124-131`; `packages/workspace/src/invitation-service.ts:170-312`; `apps/api/src/routes/workspaces.ts:175-210`; `workspace-service.ts:103-151`.

**Fix:** Add `assertCanAddSeat(workspaceId)` to the billing service: count active members + pending invitations vs the billing owner's entitlement (see 2.8 for who the billing owner is); call it from invitation create and accept. Decide free-tier policy (recommended: free = personal only, or 1 team with ≤2 seats — pick one and encode it in `BILLING_PLANS`). Surface seat usage in team settings UI.

**Acceptance:** Exceeding the seat allowance returns the standard 402 envelope (see 2.7) on invite; the team settings page shows seats used/included.

### 2.2 Deleting artifacts never frees storage (and still bills it)

**Problem:** Delete is a soft delete; S3 version objects live forever; `deleteObject` is only used for upload-failure cleanup. Worse, `getUsage` sums all versions with no artifact-state filter, so deleted artifacts still count against the owner's storage quota — users cannot reclaim space by deleting.

**Evidence:** `packages/artifact/src/artifact-service.ts:338-350,627-631`; `packages/artifact/src/drizzle-artifact-repository.ts:291-297`; `packages/billing/src/index.ts:702-706`.

**Fix:**
1. **Immediately:** exclude `state != 'active'` artifacts' versions from `getUsage` storage math.
2. Add a purge path: a scheduled job (see 2.4's scheduler) that finds artifacts soft-deleted more than N days ago (e.g. 30), deletes their version objects from S3, then hard-deletes version rows (keep the artifact row + audit events for history; null the storage keys). Make N configurable.

**Acceptance:** Deleting an artifact reduces reported storage usage at once; purge job removes objects after the grace window (verified against a MinIO/dev bucket).

### 2.3 Concurrent version writes can destroy a committed version

**Problem:** Version immutability is enforced only by the DB unique index on `(artifact_id, version_number)`. Two concurrent updates compute the same `nextVersionNumber` and upload to the **same S3 key**; the loser's conflict-cleanup then deletes that shared key, leaving the winner's committed row pointing at a deleted object.

**Evidence:** `packages/artifact/src/artifact-service.ts:230-258` (cleanup at :627-631); key scheme `packages/storage/src/index.ts:32-47`; unique index `packages/db/src/schema.ts:300`.

**Fix (pick one, recommended both):**
1. Make keys collision-proof: include a per-attempt random suffix (e.g. ULID) in the object key so two attempts never share a key; the row stores the exact key. Loser cleanup then deletes only its own object.
2. Serialize allocation: allocate the version number inside the same transaction as the row insert using `SELECT ... FOR UPDATE` on the artifact row, and only upload after the row is committed (or use a two-phase: insert row with `pending` state → upload → mark ready).

**Acceptance:** A test that fires two concurrent `updateArtifact` calls repeatedly: both succeed (or one retries), and both committed versions' content remains readable afterwards.

### 2.4 Storage metering has no scheduler

**Problem:** GB-day storage usage is only recorded via `POST /api/internal/billing/storage-snapshots` (guarded by `BILLING_CRON_SECRET`), but nothing in the repo calls it — no cron, no compose service. Storage overage is silently never metered.

**Evidence:** `apps/api/src/routes/billing.ts:91-117`; `docker-compose.yml` (api + web only).

**Fix:** Add a scheduler. Simplest robust option: a small interval timer inside the API process behind `ENABLE_BILLING_CRON=true` (daily, with jitter + advisory lock so multi-instance deployments run it once), calling the snapshot service directly rather than over HTTP. Alternatively a compose `cron` sidecar hitting the endpoint. Document `BILLING_CRON_SECRET` either way. Wire the purge job from 2.2 into the same scheduler.

**Acceptance:** Running the dev stack for a day (or invoking the job manually) produces `artifact.storage_gb_days` usage events; the job is idempotent per day.

### 2.5 No subscription reconciliation; period fields write-only

**Problem:** Entitlement resolution checks only `status`; `current_period_end` and `cancel_at_period_end` are written by webhooks but never read. A missed `subscription.expired` webhook leaves a user entitled forever. Non-subscription events (`payment.*`) are dropped.

**Evidence:** `packages/billing/src/index.ts:565-583`; `apps/api/src/routes/billing.ts:147-159`; schema `:387-388`.

**Fix:** (1) In entitlement resolution, treat a paid account as lapsed when `current_period_end` is more than a grace period (e.g. 3 days) in the past, regardless of status. (2) Add a daily reconciliation task (same scheduler as 2.4) that polls Dodo for active subscriptions of paid accounts and re-syncs status. (3) Log unhandled webhook event types at warn with the event id, so gaps are visible.

**Acceptance:** Manually expiring `current_period_end` in the DB downgrades effective entitlements without any webhook.

### 2.6 Retention windows are advertised but unenforced

**Problem:** Per-plan `auditRetentionDays` and `versionHistoryDays` exist in the plan config and marketing, but there is no pruning job and no date filter on reads — free's "7 days" is fiction in both directions.

**Evidence:** `packages/billing/src/index.ts:33,39-40,62`; `packages/artifact/src/audit-service.ts:8-37`; `drizzle-artifact-repository.ts:132-139`.

**Fix (DECISION, recommended default = enforce):** apply a `createdAt >= now() - retention` filter in `listAuditEvents` and `listVersions` based on the owner's entitlements, and add pruning of out-of-window audit rows to the scheduler. If instead you de-scope: remove retention claims from `BILLING_PLANS`, the pricing page, and the billing settings page. Do not leave the copy lying.

**Acceptance:** A free account cannot see audit events older than its window; paid upgrade widens it.

### 2.7 Plan-limit failures are raw 402s with contradictory plan names

**Problem:** No web code handles status 402; users get raw API message strings in forms with no upgrade path. Worse, the API messages use internal plan ids (Free/Builder/Studio) while the pricing page sells Builder/Pro/Team — "Private artifacts require Builder or Studio" is shown to a free user the pricing page told they're on "Builder". The billing page even claims "Upgrade prompts appear when a plan gate blocks a paid feature" — no such component exists. The pricing page also hardcodes plan copy instead of consuming `GET /api/billing/plans` (a dead endpoint), and has drifted from the source config.

**Evidence:** `apps/web` has zero matches for 402; `create-artifact-form.tsx:61-65`, `access-settings-form.tsx:40-43`, `share-links-manager.tsx:37-41`, `artifact-controls.tsx` (generic "Could not save"); names `packages/billing/src/index.ts:51-95,529` vs `apps/web/app/pricing/page.tsx:30-94` (maps pro→builder, team→studio at :59,:83); `settings/billing/page.tsx:67`.

**Fix:**
1. **One naming source of truth.** Add `displayName` to each plan in `BILLING_PLANS` and use it in every user-facing error message and the billing page. Recommended: rename public-facing strings to match the pricing page (Free→Builder, Builder→Pro, Studio→Team) or rename the pricing page to match internals — either way, one vocabulary everywhere.
2. **Structured limit errors.** Have the API return `{ error: "plan_limit_exceeded", limit: "...", requiredPlanId: "..." }` (extend `apps/api/src/http/errors.ts:35-37`).
3. **Web 402 handling.** A small shared helper that detects 402 responses and renders the message plus an "Upgrade" link to `/settings/billing` (or directly to checkout with the required plan). Apply in the four forms above, including the artifact menu's access PATCH (where the current generic "Could not save" hides the real reason).
4. Make `/pricing` consume `GET /api/billing/plans` (server-side fetch) so prices/limits can't drift; delete the hardcoded array.

**Acceptance:** On a free account, toggling an artifact to Restricted from the menu shows "Private artifacts require Pro" (final vocabulary) with a working upgrade link; pricing page renders from the API.

### 2.8 Workspace billing falls on whichever member created the project (DECISION)

**Problem:** Billing accounts are strictly per-user, but Studio/Team is sold as "shared workspace billing". Workspace artifacts bill `project.ownerUserId` — the member who happened to create the project — so one member's personal plan silently bankrolls the whole team, and creation limits bind the creator, not the workspace.

**Evidence:** `packages/db/src/schema.ts:376-396`; `packages/artifact/src/project.ts:237`; plan copy `packages/billing/src/index.ts:100`.

**Fix (recommended default):** Bill the **workspace owner** for team workspaces: resolve the billing subject as `workspace.ownerUserId` (or a dedicated `billing_user_id` column on workspaces) in every `assertCan*` and usage-recording path that today uses `project.ownerUserId`. Require the workspace owner to hold the team-tier plan to create a team (ties into 2.1). Document the model in `ABOUT.md`.

**Acceptance:** Two members of one team both create artifacts; all limits and usage accrue to the workspace owner's account.

---

## Phase 3 — Smaller defects (each is a small, self-contained fix)

### 3.1 Artifact audit page is empty for everyone but the owner
`GET /api/audit-events` hard-scopes to `ownerUserId: principal.id` (`apps/api/src/routes/share-links.ts:94-99`), so team members see an empty log and anonymous viewers get a 403 ("Cannot load audit log HTTP 403") on `/[username]/[projectSlug]/[slug]/audit`. **Fix:** authorize per-artifact instead: if the requester holds `artifact.view_audit` (admin/owner per policy) for the artifact, return its events regardless of personal ownership — or route the page through the workspace audit endpoint for members. Hide the page link for principals without the permission (the menu already does; the page itself must gate too).

### 3.2 History and diff pages are orphaned from the artifact surface
The render menu links only inline versions; the full `history` page (with diff links) is reachable only from the public project listing (`apps/web/app/[username]/[projectSlug]/page.tsx:59`). **Fix:** add "Open full history" at the bottom of the versions disclosure in `artifact-controls.tsx` linking `${base}/history`.

### 3.3 "All projects" link 404s for visitors
`/[username]` 404s for any non-owner (`app/[username]/page.tsx:13-15`), yet public project pages link to it (`app/[username]/[projectSlug]/page.tsx:35`). **Fix (DECISION):** recommended — make `/[username]` a public profile listing that owner's public projects; alternative — render the link only for the owner.

### 3.4 CLI `--all` silently truncates to 50
`--all` omits `limit`, and the API then applies its default of 50 (`apps/cli/src/list-limit.ts:20-21`; `apps/api/src/routes/share-links.ts:98`, `routes/artifacts.ts:77`) on `audit list` and `artifact versions`. **Fix:** support real pagination server-side (offset or cursor) and loop in the CLI; short-term, pass the server max and print a truncation warning when the result length equals the limit.

### 3.5 Logged-out CLI mutations surface CSRF errors
A token-less CLI mutation hits `csrfGuard` and returns `403 csrf_blocked`, which the CLI maps to "unknown" (`apps/api/src/http/middleware.ts:43-56`; `apps/cli/src/errors.ts:25-40`). **Fix:** in the CLI, before any authenticated command, check for credentials and exit with "Not signed in. Run `artifacts login`." Also map `csrf_blocked` to an auth hint.

### 3.6 CSRF guard skips all workspace mutations
The origin guard covers artifact/share/billing/profile/cli mutations but none of `POST /api/workspaces`, invitation create/accept/revoke/resend, member PATCH/DELETE — cookie-authenticated state-changing routes (`apps/api/src/http/middleware.ts:43-56`). **Fix:** add the workspace mutation paths to the guard list; add a regression test asserting every registered mutating route is either guarded or explicitly exempted.

### 3.7 MCP handler violates JSON-RPC details
Notifications (`notifications/initialized`, `ping`) receive `-32601` error responses (must be ignored / handled), and every error carries `id: null` instead of the request id (`apps/api/src/http/mcp.ts:91-117`); `protocolVersion` is pinned and `serverInfo.version` hard-coded (`:46-53`). **Fix:** return no body (202) for notifications, echo the request id in errors, negotiate the protocol version, read the server version from the package.

### 3.8 Dead endpoints — wire or delete (decision table)
- Delete: the entire `workspace by-path` family (`routes/workspaces.ts:135,161`), `GET /api/workspaces/by-slug/:slug` (:42), `GET /api/workspaces/:id` (:60) — web uses `/api/by-path/*`.
- Delete or wire: `POST /api/workspaces/:id/artifacts` (:118) — currently the web posts to `POST /api/artifacts` with the workspace slug as `ownerUsername`, leaving this route's distinct `workspace.create_content` authz path dead. **Recommended:** keep ONE canonical path — switch the web form to the workspace route and delete the slug-as-username special case, or delete the workspace route and document the slug convention.
- Wire: `GET /api/billing/plans` → pricing page (done as part of 2.7).
- Keep: storage snapshot endpoints once 2.4 lands.
- Delete or wire as async validation: the three `slug-availability` pre-check endpoints with no consumer (`routes/workspaces.ts:33,79`).
- Remove dead web helpers `fetchOwnedArtifacts`, `createWorkspace` (`apps/web/lib/server-api.ts:166,168`) if still unused after Phase 1.

### 3.9 Artifact settings page is a second, legacy-styled copy of the menu
`/[slug]/settings` re-implements access rules, share links, and delete in pre-workbench styling (`page-shell`, `card flat`) — same controls, different visual language (`apps/web/app/[username]/[projectSlug]/[slug]/settings/page.tsx`). **Fix:** restyle the page with the workbench vocabulary and make it the *full* management surface (it is the only home of viewer-emails); ensure copy and control behavior match the menu exactly (e.g. same role labels), and route both via the same components where practical.

### 3.10 Share-link fields returned but never shown; expiry has no write path
`lastUsedAt`/`expiresAt` are returned by the API and typed in the web layer but rendered nowhere; `artifact_permissions.expires_at` is *filtered on reads* but the only writer hard-codes `expiresAt: null` (`share-link-service.ts:73-87`; `drizzle-role-resolver.ts:56`; `drizzle-artifact-repository.ts:284`). **Fix:** show "last used Xd ago" and expiry in both share-link UIs; add an optional expiry to share-link creation (UI + CLI flag + API input). If expiry on email grants is unwanted, delete the column read.

### 3.11 Version integrity fields are write-only
`content_sha256` and `parent_version_id` are written for every version but never read (`schema.ts:290-292`; `artifact-service.ts:246,611`). **Fix:** verify the sha on content reads (log + 500 on mismatch — this is the durability promise) and include both fields in the versions API response; otherwise drop the columns.

### 3.12 Stale tests, dead components, stale build artifacts
- e2e smoke assertions don't match current copy (`apps/web/e2e/smoke.spec.ts:12,22` — pricing heading, "Continue with Google"): update to the live strings (and re-check after 0.3/2.7 copy changes).
- `app/components/site-footer.tsx` is never imported — delete it (its anchors are landing-only and would be broken elsewhere).
- `apps/api/dist/` is stale and tracked (contains `share-session.d.ts` for a deleted module) — delete the directory and gitignore it.

### 3.13 CLI binary reports version 0.0.0
`readCliVersion()` resolves `../package.json` relative to the bundled file, which doesn't exist in the compiled Bun binary (`apps/cli/src/version.ts:4-12`). **Fix:** inject the version at build time (`bun build --define` or codegen a `version.ts` in `scripts/build-prod.ts`).

### 3.14 `email_verified` is surfaced but never enforced
Invitation accept copy claims "a verified email is required" but the check is presence-only (`packages/workspace/src/invitation-service.ts:252-254`). **Fix:** enforce `user.emailVerified` there (Google OAuth users are verified, so impact is nil today) or fix the copy.

---

## Phase 4 — Hygiene and consistency

### 4.1 Web app re-declares shared types by hand
`apps/web/package.json` depends on `@agent-artifacts/billing` and `@agent-artifacts/shared` but never imports them; `apps/web/lib/server-api.ts:21-31` hand-rolls the response types. **Fix:** import the real types from `shared` (and `billing` for plan shapes) so API changes break the web typecheck instead of drifting silently; or drop the unused deps if importing server-only packages into Next is undesirable.

### 4.2 Dead exports sweep
Remove or internalize (per the package audit): `packages/shared` — `artifactStateSchema`, `permissionSubjectTypeSchema`, `principalSchema` (unused validator), `buildProjectUrl`, `buildProjectArtifactUrl`; `packages/access` — re-export of `ArtifactForbiddenError`, standalone `authorize`/`assertAuthorized` (make internal); `packages/artifact` — delete `src/drizzle-owner-lookup.ts` (entire file dead), drop access re-exports at `index.ts:45-48`; `packages/workspace` — internalize the policy helpers listed in the audit; `packages/billing` — internalize `resolveEntitlements`, `createCheckoutSessionInput`, drop the legacy non-transactional webhook fallback path (`index.ts:359-366`). Keep `MemoryArtifactRoleResolver`-style test fakes exported only from test utilities.

### 4.3 Schema truth-telling
After Phases 1-2, re-visit `packages/db/src/schema.ts`: drop enum values and columns that ended up with no read/write path (`permission subject_type` values `agent|api_key|share_link` and `user|anyone` if 1.4/3.10 don't use them; `archived` states if 1.2 removed archive; `session.ip_address/user_agent` stay — better-auth owns them). One migration, with a short comment per dropped item.

### 4.4 Dev-stack hydration warning
A React hydration error appears in the dev overlay on artifact pages (locale-sensitive date formatting is the suspect class). Reproduce on `/laxman/default/ui-shell-test-artifact`, read the dev-overlay call stack, and fix the offending server/client mismatch.

### 4.5 Test coverage for everything above
Each phase item lands with its own test where the harness exists: API route tests for 0.1/0.4/2.x guards, CLI command tests (non-dry-run schema parsing, 3.4 pagination), Playwright specs for share redemption (0.1), editor flow (1.1), 402 upgrade prompt (2.7). Fix the e2e harness copy drift first (3.12) so the suite is green before adding to it.

---

## Suggested execution order (one item per commit)

0.1 → 0.4 → 0.5 → 0.2 → 0.3 → 3.12 (green tests) → 2.7 → 1.3 → 1.1 → 1.6 → 3.1 → 3.2 → 3.5 → 3.6 → 3.7 → 1.2 → 1.5 → 2.2 → 2.3 → 2.4 → 2.5 → 2.1 → 2.8 → 2.6 → 1.4 → 3.3 → 3.4 → 3.8 → 3.9 → 3.10 → 3.11 → 3.13 → 3.14 → 4.1 → 4.2 → 4.3 → 4.4

Rationale: ship the user-visible breakages and the trust-destroying billing/naming issues first; do the API-key build (1.4) late because it's the largest standalone project; leave schema/dead-code sweeps for the end so they don't churn under the feature work.
