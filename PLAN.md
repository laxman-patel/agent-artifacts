# Agent Artifact Plan

## Premise

Agents are increasingly producing rich artifacts instead of plain chat output: HTML reports, Markdown specs, React prototypes, interactive explainers, mockups, dashboards, PR summaries, review surfaces, and throwaway tools. Today those artifacts are usually left as local files, chat attachments, or unversioned blobs. They are difficult to share, hard to revisit, and unsafe to edit collaboratively.

`agent-artifact` is a hosted artifact service for human and agent workflows. It exposes an MCP interface that any agent can plug into, plus a web interface for humans. Agents can create, update, version, share, and permission artifacts. Humans can view, compare, manage, and collaborate on them.

The product should feel like a focused blend of:

- GitHub Gist for durable artifact storage.
- Vercel Preview for hosted visual output.
- Google Docs-style access control.
- Git-style immutable version history.
- MCP-native automation for agents.

## Goals

- Host agent-produced artifacts as durable, shareable URLs.
- Support three first-class artifact types: HTML, Markdown, and React components.
- Track every artifact change as an immutable version.
- Allow humans and agents to create, edit, fork, diff, restore, and archive artifacts.
- Provide strict access control for viewing and editing.
- Expose all core operations through MCP tools and the web interface.
- Use `better-auth` for authentication, sessions, organization membership, API keys, and role-aware authorization.
- Store artifact content in object storage, with structured metadata in Postgres.
- Keep rendering isolated and safe, especially for HTML and React artifacts.
- Make the system extensible for future artifact types, multi-file projects, comments, reviews, and embedded usage inside agent products.

## Non-Goals

- Do not build a general-purpose website builder.
- Do not build a full Git hosting system.
- Do not initially support arbitrary long-running server code inside artifacts.
- Do not trust artifact content just because it was produced by an authenticated user or agent.
- Do not treat MCP access as separate from human access. Both must pass through the same authorization model.

## Users

### Human Users

Humans use the web interface to:

- Sign in.
- Create workspaces or join existing ones.
- View artifacts shared with them.
- Create or manually edit artifacts.
- Review version history and diffs.
- Manage access rules.
- Create API keys or agent identities.
- Revoke compromised tokens.
- Audit who created or edited an artifact.

### Agent Users

Agents use MCP tools to:

- Create artifacts from generated content.
- Update artifacts as a task evolves.
- Fetch artifact metadata or content.
- List versions.
- Compare versions.
- Restore or fork versions.
- Set access policies when allowed.
- Share links back to humans.

Agents are authenticated identities, not anonymous system actors. They may act on behalf of a human user, a workspace, or a specific agent installation.

## Core Concepts

### Workspace

A workspace owns artifacts, members, agent identities, API keys, and policy defaults.

Workspaces allow the service to distinguish personal artifacts from team artifacts.

### Principal

A principal is any authenticated actor that can perform an action:

- Human user.
- Agent identity.
- API key.
- OAuth client.
- Service account.

All authorization decisions should use the principal abstraction.

### Artifact

An artifact is the stable logical object that users share and update.

An artifact has:

- Stable ID.
- Workspace owner.
- Type.
- Title.
- Description.
- Current version pointer.
- Lifecycle state.
- Access policy.
- Metadata.

The artifact URL always points to the current version unless a version is pinned in the URL.

### Artifact Version

An artifact version is immutable. Every create, update, restore, or transform operation creates a new version.

A version has:

- Monotonic version number.
- Content object key.
- Content hash.
- Created-by principal.
- Optional changelog.
- Optional parent version.
- Render status.
- Validation status.
- Timestamps.

### Artifact Type

Supported artifact types:

- `html`: self-contained HTML document or fragment.
- `markdown`: Markdown document rendered to sanitized HTML.
- `react`: React component source rendered through a sandboxed build pipeline.

### Access Policy

Access policy controls who can view, edit, administer, and share an artifact.

Access can be:

- Public to anyone with the link.
- Restricted to workspace members.
- Restricted to explicit email allowlist.
- Restricted to explicit agent identities.
- Restricted to generated share links.

Viewing and editing must be modeled independently.

## Product Surface

### Web Interface

The web app should include:

- Landing page explaining agent artifact hosting.
- Sign-in and account management.
- Workspace switcher.
- Artifact dashboard.
- Artifact creation flow.
- Artifact viewer.
- Version history page.
- Version diff page.
- Artifact settings page.
- Access management UI.
- Agent/API key management UI.
- Audit log UI.

Primary routes:

- `/`
- `/login`
- `/dashboard`
- `/workspaces/:workspaceId`
- `/a/:artifactId`
- `/a/:artifactId/v/:versionNumber`
- `/a/:artifactId/history`
- `/a/:artifactId/diff/:fromVersion...:toVersion`
- `/a/:artifactId/settings`
- `/settings/account`
- `/settings/workspaces`
- `/settings/agents`
- `/settings/api-keys`

### MCP Interface

The MCP server is a first-class product surface. It should expose tools that map cleanly to product capabilities.

Core tools:

- `create_artifact`
- `update_artifact`
- `get_artifact`
- `get_artifact_content`
- `list_artifacts`
- `list_artifact_versions`
- `diff_artifact_versions`
- `restore_artifact_version`
- `fork_artifact`
- `archive_artifact`
- `set_artifact_access`
- `get_artifact_access`
- `create_share_link`
- `revoke_share_link`

Administrative tools:

- `list_workspaces`
- `get_current_principal`
- `list_workspace_members`
- `list_agent_identities`
- `create_agent_identity`
- `revoke_agent_identity`

Every MCP tool must enforce the same authorization checks as the HTTP API and web interface.

### HTTP API

The HTTP API supports the web app and external integrations.

Suggested route groups:

- `/api/auth/*`
- `/api/workspaces/*`
- `/api/artifacts/*`
- `/api/artifacts/:artifactId/versions/*`
- `/api/artifacts/:artifactId/access/*`
- `/api/agents/*`
- `/api/share-links/*`
- `/api/audit-events/*`
- `/mcp`

## Authentication

Use `better-auth` as the auth foundation.

Required capabilities:

- Email/password sign-in.
- OAuth provider support.
- Session management.
- Organization/workspace support.
- API key support.
- Role and permission integration.
- Account linking where supported.

Authentication must identify the principal. Authorization must decide what the principal can do.

### Human Authentication

Humans authenticate through `better-auth` sessions in the web app.

Human users can:

- Own personal workspaces.
- Create team workspaces.
- Invite members.
- Create agent identities.
- Issue API keys.
- Manage artifact access if they have permission.

### Agent Authentication

Agents authenticate through scoped credentials created by a human or workspace admin.

Supported credential forms:

- `better-auth` API keys for MCP clients.
- OAuth client credentials where appropriate.
- Future: signed installation tokens for hosted agent platforms.

Agent identity records should include:

- Display name.
- Owning workspace.
- Created-by user.
- Credential hash or auth provider binding.
- Allowed scopes.
- Default role.
- Last used timestamp.
- Revocation timestamp.

Agents should never inherit unlimited owner permissions by default. They should receive explicit scopes and artifact/workspace roles.

## Authorization

Authorization must be centralized. The web app, HTTP API, and MCP tools should call the same policy layer.

### Roles

Workspace roles:

- `owner`: full workspace control, billing, destructive admin actions.
- `admin`: member, agent, and artifact administration.
- `member`: create and manage own artifacts, collaborate on shared artifacts.
- `viewer`: view workspace artifacts allowed by policy.

Artifact roles:

- `owner`: full control over a specific artifact.
- `admin`: manage access and lifecycle.
- `editor`: create new versions and edit metadata.
- `viewer`: view artifact and versions.

Share-link roles:

- `viewer`: link grants read access.
- `editor`: link grants edit access if artifact allows editable links.

Agent scopes:

- `artifacts:read`
- `artifacts:create`
- `artifacts:update`
- `artifacts:delete`
- `artifacts:share`
- `artifacts:access:read`
- `artifacts:access:write`
- `workspaces:read`
- `agents:manage`

An action is allowed only when both role and scope checks pass for agent/API key principals.

### Permission Subjects

Artifact access rules may target:

- `anyone`
- `workspace`
- `workspace_role`
- `user`
- `email`
- `agent`
- `api_key`
- `share_link`

Email allowlists are useful for pre-invite sharing. Once a user with that email signs in, the permission should resolve to that user while preserving the original email rule for auditability.

### Permission Actions

Policy checks should cover:

- `artifact.view`
- `artifact.create`
- `artifact.update`
- `artifact.restore`
- `artifact.fork`
- `artifact.diff`
- `artifact.archive`
- `artifact.delete`
- `artifact.manage_access`
- `artifact.create_share_link`
- `artifact.revoke_share_link`
- `workspace.manage_members`
- `workspace.manage_agents`
- `workspace.manage_api_keys`

### Enforcement Requirements

- Never rely on UI hiding alone.
- Never rely on MCP tool descriptions for security.
- Every API route must identify the principal and call the authorization layer.
- Every MCP tool must identify the principal and call the authorization layer.
- Object storage objects must not be public by default for restricted artifacts.
- Public artifacts can be served through stable public URLs, but restricted artifacts must use checked routes or short-lived signed URLs.
- Editing an artifact must require edit permission on the artifact and update scope for agent principals.
- Managing access must require admin or owner permission on the artifact.
- Creating editable share links must require artifact admin permission.

## Data Model

Use Postgres as the source of truth for metadata and authorization state.

Suggested tables:

- `users`
- `accounts`
- `sessions`
- `verifications`
- `workspaces`
- `workspace_members`
- `agent_identities`
- `api_keys`
- `artifacts`
- `artifact_versions`
- `artifact_permissions`
- `share_links`
- `audit_events`
- `render_jobs`
- `render_outputs`

`better-auth` owns or integrates with auth-related tables. Domain tables should reference `better-auth` user IDs where appropriate.

### Artifacts Table

Fields:

- `id`
- `workspace_id`
- `title`
- `description`
- `type`
- `state`
- `latest_version_id`
- `created_by_principal_type`
- `created_by_principal_id`
- `created_at`
- `updated_at`
- `archived_at`

Valid states:

- `active`
- `archived`
- `deleted`

### Artifact Versions Table

Fields:

- `id`
- `artifact_id`
- `version_number`
- `parent_version_id`
- `content_object_key`
- `content_sha256`
- `content_bytes`
- `changelog`
- `created_by_principal_type`
- `created_by_principal_id`
- `created_at`
- `validation_status`
- `render_status`
- `render_output_id`

### Artifact Permissions Table

Fields:

- `id`
- `artifact_id`
- `subject_type`
- `subject_id`
- `email`
- `role`
- `created_by_principal_type`
- `created_by_principal_id`
- `created_at`
- `expires_at`
- `revoked_at`

### Share Links Table

Fields:

- `id`
- `artifact_id`
- `token_hash`
- `role`
- `created_by_principal_type`
- `created_by_principal_id`
- `created_at`
- `expires_at`
- `revoked_at`
- `last_used_at`

### Audit Events Table

Fields:

- `id`
- `workspace_id`
- `artifact_id`
- `actor_principal_type`
- `actor_principal_id`
- `action`
- `target_type`
- `target_id`
- `metadata`
- `created_at`

Audit events should be append-only.

## Storage

Use S3-compatible object storage. Cloudflare R2 is a good default, with AWS S3 and MinIO supported through the same adapter.

Store immutable version content by content hash or version key:

- `workspaces/{workspaceId}/artifacts/{artifactId}/versions/{versionNumber}/source`
- `workspaces/{workspaceId}/artifacts/{artifactId}/versions/{versionNumber}/rendered`
- `workspaces/{workspaceId}/artifacts/{artifactId}/versions/{versionNumber}/assets/*`

Requirements:

- Version content is immutable.
- Restricted content is private in storage.
- Public serving should go through the app/CDN layer unless an artifact is explicitly public.
- Use checksums to detect duplicate content.
- Keep metadata in Postgres, not object metadata.
- Support migration between storage providers through an adapter.

## Rendering

Rendering must prioritize isolation, correctness, and predictable output.

### HTML Artifacts

HTML artifacts may be:

- Full HTML documents.
- Body fragments wrapped in a service-provided shell.

HTML must be served in a sandboxed iframe. Default sandbox policy should block privileged browser capabilities unless explicitly needed.

Requirements:

- Sanitize where possible.
- Apply strict CSP.
- Disallow access to parent window.
- Do not grant same-origin unless required for a specific safe mode.
- Block network access by default for restricted/private artifacts where possible.
- Provide clear warnings for externally loaded resources.

### Markdown Artifacts

Markdown artifacts are rendered to sanitized HTML.

Requirements:

- GitHub-flavored Markdown support.
- Syntax highlighting.
- Tables, task lists, and code blocks.
- Sanitized output.
- Optional Mermaid or diagram support through a controlled renderer.
- Stable source view.

### React Artifacts

React artifacts are single-component or small project artifacts rendered in a controlled build environment.

Requirements:

- TypeScript and JSX support.
- React 19+ support.
- Constrained dependency policy.
- Build timeout.
- Runtime timeout where possible.
- No server-side secrets exposed to artifact code.
- Sandboxed preview iframe.
- Clear build errors displayed in the UI.
- Versioned build output.

React artifact modes:

- `component`: a single exported component with allowed imports.
- `project`: a future multi-file artifact with manifest, assets, and dependency lockfile.

For the full product spec, both modes should be designed, but `component` should be the first implementation path.

## Versioning

Versioning is central to the product.

Rules:

- Artifact versions are immutable.
- Version numbers are monotonic per artifact.
- Updating content creates a new version.
- Restoring an old version creates a new version with the restored content.
- Metadata-only changes can be audited without creating a content version.
- Access policy changes do not create content versions, but they do create audit events.

Version history should show:

- Version number.
- Actor.
- Actor type.
- Changelog.
- Content hash.
- Created time.
- Validation/render status.
- Diff link.

## Diffs

Diffs should be useful for both humans and agents.

Markdown diffs:

- Source diff.
- Rendered visual diff where possible.

HTML diffs:

- Source diff.
- DOM-aware diff where possible.
- Rendered screenshot diff as a future enhancement.

React diffs:

- Source diff.
- Build output metadata diff.
- Rendered screenshot diff as a future enhancement.

MCP diff output should support:

- Summary.
- Unified diff.
- Changed sections where detectable.
- URLs to visual diff pages.

## MCP Tool Specification

### `create_artifact`

Creates a new artifact and first version.

Input:

- `workspaceId`
- `type`
- `title`
- `content`
- `description`
- `access`
- `changelog`
- `metadata`

Output:

- `artifactId`
- `versionId`
- `versionNumber`
- `url`
- `historyUrl`
- `accessSummary`

Authorization:

- Requires workspace artifact creation permission.
- Agent principals require `artifacts:create`.

### `update_artifact`

Creates a new artifact version.

Input:

- `artifactId`
- `content`
- `changelog`
- `expectedLatestVersion`

Output:

- `artifactId`
- `versionId`
- `versionNumber`
- `url`
- `diffUrl`

Authorization:

- Requires artifact editor or higher.
- Agent principals require `artifacts:update`.

Concurrency:

- If `expectedLatestVersion` is provided and stale, return a conflict with latest version info.

### `get_artifact`

Returns artifact metadata and links.

Input:

- `artifactId`
- `versionNumber`

Output:

- Artifact metadata.
- Selected version metadata.
- Access summary.
- View URL.
- Content URL when allowed.

Authorization:

- Requires artifact view permission.
- Agent principals require `artifacts:read`.

### `get_artifact_content`

Returns artifact source content for a version.

Input:

- `artifactId`
- `versionNumber`

Output:

- `type`
- `content`
- `contentSha256`
- `versionNumber`

Authorization:

- Requires artifact view permission.
- Agent principals require `artifacts:read`.

### `list_artifact_versions`

Lists immutable versions.

Input:

- `artifactId`
- `limit`
- `cursor`

Output:

- Version list.
- Pagination cursor.

Authorization:

- Requires artifact view permission.

### `diff_artifact_versions`

Returns or links to a diff between versions.

Input:

- `artifactId`
- `fromVersion`
- `toVersion`
- `format`

Output:

- Summary.
- Diff content or diff URL.

Authorization:

- Requires artifact view permission.

### `restore_artifact_version`

Creates a new latest version from an old version.

Input:

- `artifactId`
- `versionNumber`
- `changelog`

Output:

- New version metadata.
- URL.

Authorization:

- Requires artifact editor or higher.
- Agent principals require `artifacts:update`.

### `fork_artifact`

Creates a new artifact from an existing version.

Input:

- `artifactId`
- `versionNumber`
- `targetWorkspaceId`
- `title`
- `access`

Output:

- New artifact metadata.
- URL.

Authorization:

- Requires view permission on source.
- Requires create permission in target workspace.

### `set_artifact_access`

Updates artifact access rules.

Input:

- `artifactId`
- `visibility`
- `viewers`
- `editors`
- `admins`
- `shareLinks`

Output:

- Access summary.

Authorization:

- Requires artifact admin or owner.
- Agent principals require `artifacts:access:write`.

### `create_share_link`

Creates a revocable share link.

Input:

- `artifactId`
- `role`
- `expiresAt`

Output:

- Share URL.
- Role.
- Expiration.

Authorization:

- Requires artifact admin or owner.

## Security

Security must be designed into the product from the start.

### Artifact Content Security

HTML and React artifacts are untrusted content.

Controls:

- Sandboxed iframes.
- Strict CSP.
- Private object storage for restricted artifacts.
- No cookies or auth tokens exposed inside artifact frames.
- Separate preview origin if possible.
- Sanitize Markdown.
- Validate uploaded content size and type.
- Rate limit creation and update operations.
- Scan for dangerous patterns where useful, without relying on scanning as the main defense.

### Auth Security

Controls:

- `better-auth` session handling.
- Secure cookies.
- CSRF protection for browser mutations.
- API keys stored hashed.
- Agent credentials revocable.
- Scope-limited agent access.
- Audit sensitive changes.
- Optional 2FA support for humans.

### Access Control Security

Controls:

- Central policy engine.
- Route-level and tool-level checks.
- Object access mediated by app authorization.
- Short-lived signed URLs for private content.
- Explicit permission tests.
- Deny by default.

## Auditability

Every sensitive action should create an audit event:

- Artifact created.
- Artifact updated.
- Artifact restored.
- Artifact forked.
- Artifact archived.
- Access rule changed.
- Share link created or revoked.
- Agent identity created or revoked.
- API key created or revoked.
- Failed authorization for sensitive operations where useful.

Audit logs should be visible to workspace owners and admins.

## Tech Stack

Use the latest stable TypeScript-first stack.

Recommended monorepo:

- Package manager: `pnpm`
- Build system: `Turborepo`
- Runtime: `Node.js 24`
- Language: `TypeScript`
- Web app: `Next.js`
- API server: `Hono` or `Fastify`
- MCP server: official TypeScript MCP SDK
- Auth: `better-auth`
- Database: `Postgres`
- ORM: `Drizzle`
- Object storage: S3-compatible adapter for R2/S3/MinIO
- Validation: `Zod`
- Testing: `Vitest`, `Playwright`
- Styling: Tailwind CSS
- Deployment: Docker first, with adapters for Fly.io, Render, Railway, Cloudflare, or Kubernetes

Suggested structure:

```txt
apps/
  api/
  web/
  worker/

packages/
  auth/
  db/
  policy/
  artifact/
  storage/
  renderer/
  mcp/
  shared/
  config/
```

### Package Responsibilities

`apps/api`:

- HTTP API.
- MCP endpoint.
- Auth callbacks.
- Signed content routes.

`apps/web`:

- Human-facing UI.
- Artifact viewer.
- Settings and access management.

`apps/worker`:

- Render jobs.
- React builds.
- Screenshot/diff jobs.
- Cleanup tasks.

`packages/auth`:

- `better-auth` configuration.
- Principal resolution.
- Session/API key helpers.

`packages/policy`:

- Central authorization checks.
- Role and scope evaluation.
- Permission query helpers.

`packages/artifact`:

- Artifact domain service.
- Version creation.
- Restore/fork logic.
- Validation.

`packages/storage`:

- S3-compatible object storage adapter.
- Signed URL generation.
- Content-addressed writes.

`packages/renderer`:

- Markdown rendering.
- HTML wrapping.
- React build/render pipeline.

`packages/mcp`:

- MCP tool definitions.
- Input/output schemas.
- Tool handlers that call domain services.

## API Design Principles

- Domain services own business rules.
- API routes and MCP tools should be thin adapters.
- Authorization belongs near the domain action, not only at the transport layer.
- All external inputs use schema validation.
- All mutations write audit events.
- All content updates are immutable version appends.
- Public URLs should be stable.
- Restricted URLs should be mediated.

## User Workflows

### Agent Creates Public Artifact

1. Agent authenticates through MCP with scoped credentials.
2. Agent calls `create_artifact`.
3. Service validates type and content.
4. Service writes content to object storage.
5. Service creates artifact and version rows.
6. Service creates default access policy.
7. Service returns share URL.

### Agent Updates Existing Artifact

1. Agent calls `update_artifact` with `artifactId`.
2. Policy checks edit role and agent scope.
3. Service checks optional version precondition.
4. Service writes immutable content.
5. Service creates next version.
6. Service updates artifact latest pointer.
7. Service returns latest URL and diff URL.

### Human Restricts Access

1. Human opens artifact settings.
2. Human changes view/edit policy.
3. API checks artifact admin permission.
4. Policy updates are saved.
5. Audit event is recorded.
6. Future web, API, and MCP reads respect the new rules.

### Agent Grants Editor Access

1. Agent calls `set_artifact_access`.
2. MCP credential is resolved to an agent principal.
3. Policy checks `artifact.manage_access`.
4. Scope check requires `artifacts:access:write`.
5. Access rules are updated.
6. Audit event records the agent actor.

### Restricted Artifact View

1. Viewer opens artifact URL.
2. App resolves session/share token.
3. Policy checks `artifact.view`.
4. App fetches content or render output through private storage.
5. Artifact renders in a sandboxed viewer.

## Testing Strategy

### Unit Tests

Cover:

- Policy decisions.
- Role inheritance.
- Agent scope checks.
- Artifact version creation.
- Restore and fork behavior.
- Access rule resolution.
- Storage key generation.
- Renderer validation.

### Integration Tests

Cover:

- Human session access.
- API key access.
- MCP tool authorization.
- Public artifact reads.
- Restricted artifact denial.
- Email allowlist access.
- Agent update flow.
- Access policy changes respected across web/API/MCP.

### End-to-End Tests

Cover:

- Sign in.
- Create workspace.
- Create artifact.
- Share artifact.
- Update artifact.
- View history.
- Compare versions.
- Restrict access.
- Verify denied access from another user.
- Use MCP client credentials to create and update an artifact.

### Security Tests

Cover:

- HTML sandbox escape attempts.
- Markdown XSS payloads.
- React preview isolation.
- Private storage URL leakage.
- API key revocation.
- Unauthorized MCP access.
- CSRF-sensitive browser mutations.

## Deployment

Required services:

- Web/API runtime.
- Worker runtime.
- Postgres.
- S3-compatible object storage.
- Optional Redis or queue backend.

Deployment requirements:

- Environment-based config.
- Database migrations.
- Health checks.
- Structured logs.
- Metrics.
- Error tracking.
- Object storage lifecycle policies.
- Backup and restore plan.

Important environment variables:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `PUBLIC_APP_URL`
- `ARTIFACT_RENDER_ORIGIN`

## Observability

Track:

- Artifact create/update counts.
- Version counts.
- Render success/failure rate.
- MCP tool usage.
- Authorization denials.
- Storage bytes used.
- Public vs restricted artifact counts.
- Agent identity activity.
- API latency.
- Worker job latency.

Logs should include request IDs and principal IDs, but never raw credentials or private artifact content.

## Future Capabilities

Planned extensions:

- Comments and review threads.
- Visual screenshot diffs.
- Multi-file React projects.
- Artifact templates.
- Organization design-system references.
- Agent-generated changelog summaries.
- Embeddable artifact viewer.
- Custom domains.
- Webhooks.
- GitHub PR attachment flow.
- Slack/Linear/Jira integrations.
- Artifact collections.
- Branching and merge workflows.
- Expiring edit sessions.
- Usage billing.

## Implementation Milestones

### Milestone 1: Foundation

- Monorepo setup.
- Database schema.
- `better-auth` configuration.
- Workspace model.
- Principal abstraction.
- Policy package.
- Storage adapter.

### Milestone 2: Artifact Core

- Artifact create/update/read services.
- Immutable versioning.
- Object storage writes.
- Public and restricted content serving.
- Audit events.

### Milestone 3: Web Experience

- Dashboard.
- Artifact viewer.
- Artifact history.
- Source view.
- Version diff page.
- Access settings UI.

### Milestone 4: MCP Experience

- MCP server.
- Tool schemas.
- Agent/API key authentication.
- Create/update/get/list/diff/access tools.
- MCP authorization tests.

### Milestone 5: Renderers

- Markdown renderer.
- HTML iframe renderer.
- React component build pipeline.
- Render worker.
- Render status UI.

### Milestone 6: Collaboration and Governance

- Workspace invitations.
- Email allowlists.
- Agent identity management.
- Share links.
- Audit log UI.
- Revocation flows.

### Milestone 7: Hardening

- Security tests.
- Rate limits.
- CSP hardening.
- Render isolation.
- Observability.
- Backups.
- Deployment automation.

## Open Questions

- Should public artifact content be served directly from object storage/CDN or always through the app domain?
- Should React artifacts support dependencies at launch, or only a curated allowlist?
- Should agent identities be workspace-level only, or can they be artifact-scoped?
- Should email allowlist access require login, magic-link verification, or both?
- Should editable public links be allowed at all?
- Should artifact URLs be guess-resistant IDs, slugs, or both?
- Should HTML artifacts allow external network requests by default?
- Should the service offer a local/self-hosted mode from day one?

## Guiding Principle

The service should make rich agent outputs durable, shareable, revisable, and governable without making agents special bypass actors. A human using the UI and an agent using MCP should operate through the same artifact model, the same versioning rules, and the same authorization layer.
