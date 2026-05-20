# agent-artifacts

## What this codebase does

Monorepo (pnpm/Turbo) hosting versioned HTML, Markdown, and React artifacts for humans and agents. Stack: Next.js web app (`apps/web`), Hono API (`apps/api`), shared packages for auth, access policy, artifact CRUD, S3 storage, and an MCP server. Users sign in with Google (Better Auth), claim a username, organize artifacts under projects, and share via public flags, email grants, or expiring share links. Next.js rewrites `/api/*` to the Hono API so session cookies stay on the web origin.

## Auth shape

- **`createAuth()`** — Better Auth with Google OAuth, `bearer()` and `mcp()` plugins; session via cookie or Bearer token.
- **`resolvePrincipal()`** vs **`requirePrincipal()`** — reads allow unauthenticated callers (falls back to `anonymous-public-viewer` service principal); mutations require a session.
- **`requireHumanPrincipal()`** — audit routes reject non-user principals (agents/API keys).
- **`createArtifactAccess()`** + **`authorize()`** / **`assertAuthorized()`** — access layer; **`DrizzleArtifactRoleResolver`** resolves roles from DB permissions, public flags, email grants, and share cookies.
- **`canPerformArtifactAction()`** — policy layer mapping `ArtifactAction` → minimum role + agent scope; **`hasScope()`** enforces scopes only for `agent`/`api_key` principals (users and `service` bypass).
- **`resolveShareGrant()`** + **`attachShareGrant()`** — reads `aa_share_{artifactId}` cookie and augments `principal.artifactRoleGrants` for share-link editor/viewer access.
- **`withMcpAuth()`** — wraps `/mcp` tool calls; unauthenticated `initialize` / `tools/list` probes are intentionally allowed.

## Threat model

Primary goals for an attacker: read or overwrite another user's private artifacts (IDOR / cross-tenant), escalate share-link or public-edit grants to admin-level actions, abuse MCP OAuth tokens to mutate artifacts beyond intended scope, and weaponize stored HTML/React/Markdown for XSS in viewers. Secondary: brute-force share tokens, CSRF against cookie-authenticated mutations, and namespace squatting via username/project slug races.

## Project-specific patterns to flag

- **Dual principal resolution** — any route using `resolvePrincipal` must still enforce artifact permissions in `ArtifactService`; missing `assertAuthorized` on a write path is critical.
- **Share-link bypass** — `/api/share/:token` resolves the token then calls `getArtifact` with a synthetic `service` principal; the raw token is the only credential — weak generation or logging leaks full access.
- **Default public view** — new artifacts default to `publicView: true`; private-by-default is not the default in `createArtifactInputSchema`.
- **Agent scope gaps** — `Principal.type === "user" | "service"` skips scope checks in `hasScope()`; ensure agent/API-key paths never inherit user bypass accidentally.
- **User-generated rendering** — HTML uses CSP via `wrapHtmlWithCsp()` (`unsafe-inline` scripts); React artifacts run in an iframe sandbox loading CDN scripts with `unsafe-eval` (`react-viewer.tsx`). Stored XSS and supply-chain via CDN are in scope.
- **Direct share-link management in API** — share-link create/list/revoke in `app.ts` call `checkArtifactPermission` inline rather than only through service methods; easy to miss on new endpoints.

## Known false-positives

- **`/health`**, **`/.well-known/oauth-protected-resource`**, **`/api/slug-preview/*`** — intentionally unauthenticated (metadata / URL preview only).
- **`POST /mcp`** with `initialize` or `tools/list` — no auth by design so MCP clients can discover tools before OAuth.
- **`anonymous-public-viewer`** service principal — intentional fallback for public artifact reads when `publicView` is enabled.
- **`MemoryArtifactRoleResolver`** in package tests — in-memory test double, not production auth.
- **CSRF guard skipped for Bearer** — `csrfOriginGuard` bypasses when `Authorization: Bearer` is present; MCP/CLI clients rely on this.
- **HTML/React CSP allows inline script** — deliberate tradeoff so user artifact content can execute; not a missing CSP header.
