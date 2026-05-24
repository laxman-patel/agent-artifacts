# Code Review — Handoff Tasks

Audit performed against `main` @ `06af19e`. Each task below is self-contained: assignable to one agent without context from any other task. Tasks are grouped by **independence zone** so multiple agents can work in parallel without conflicting on the same files.

**Convention for every task:**
- **Files** — exact paths the agent will touch.
- **Problem** — what's wrong, with line citations.
- **Fix** — concrete steps. No invention required.
- **Acceptance** — how to verify done.
- **Do NOT** — explicit scope guard rails.

Run after each task: `bun run typecheck && bun run test`.

---

## Independence Zones

| Zone | Tasks | Touches |
|------|-------|---------|
| A | T1, T2, T3 | `apps/api/src/routes/*.ts`, `apps/api/src/http/*.ts` |
| B | T4 | `apps/web/lib/server-api.ts`, all `apps/web/app/[username]/[projectSlug]/[slug]/**/*.tsx` |
| C | T5, T6 | `apps/cli/src/*.ts` |
| D | T7 | `packages/mcp/src/index.ts` |
| E | T8 | `packages/artifact/src/index.ts` → split |
| F | T9, T10 | `packages/artifact/src/*.ts`, `packages/access/src/index.ts`, `packages/policy/src/index.ts` |
| G | T12, T11 (sequential) | `packages/shared/src/cookie.ts`, `apps/api/src/share-session.ts`, `apps/api/src/cli-auth.ts`, `packages/artifact/src/share-link-service.ts`, `apps/api/src/http/principal.ts` |
| H | T13 | `apps/api/src/rate-limit.ts` |
| I | T14, T15 | `packages/artifact/src/project.ts`, `apps/api/src/routes/profile.ts` |
| J | T16 | `apps/web/proxy.ts`, `apps/web/app/**/page.tsx` (read-only) |
| K | T17 | `packages/db/src/schema.ts`, all role-narrowing call sites |
| L | T18 | `packages/config/src/load-monorepo-env.ts` (delete), `apps/api/src/load-env.ts`, `apps/web/next.config.ts` |
| M | T19 | `apps/web/lib/server-auth.ts`, `apps/api/src/deps.ts` |

Zones A–F and H–M can proceed in parallel with each other. **Within Zone G, run T12 before T11** — T12 extracts `readCookie` from `apps/api/src/share-session.ts`; T11 deletes that file. Within any other zone, run tasks sequentially in the order listed.

---

## ZONE A — API route boilerplate

### T1 — Extract `handle()` wrapper for route handlers

**Files**
- Create: `apps/api/src/http/handler.ts`
- Edit: `apps/api/src/routes/artifacts.ts`, `share-links.ts`, `profile.ts`, `projects.ts`, `cli.ts`, `index.ts`

**Problem**
Every route handler in `apps/api/src/routes/` is wrapped in the same `try { ... } catch (error) { return artifactErrorResponse(c, error); }`. Count: 25 try/catch blocks across 5 files. Identical pattern in `routes/index.ts:25-31` for the MCP route (with `mcpErrorResponse`). Example: `apps/api/src/routes/artifacts.ts:14-153`.

**Fix**
1. Create `apps/api/src/http/handler.ts` exporting:
   ```ts
   import type { Context } from "hono";
   import type { ContentfulStatusCode } from "hono/utils/http-status";
   import { artifactErrorResponse } from "./errors.js";

   export async function handle<T>(
     c: Context,
     work: () => Promise<T | { body: T; status: ContentfulStatusCode; headers?: Record<string, string> }>
   ) {
     try {
       const result = await work();
       if (result && typeof result === "object" && "body" in result && "status" in result) {
         const envelope = result as { body: T; status: ContentfulStatusCode; headers?: Record<string, string> };
         if (envelope.headers) for (const [k, v] of Object.entries(envelope.headers)) c.header(k, v);
         return c.json(envelope.body as never, envelope.status);
       }
       return c.json(result as never);
     } catch (error) {
       return artifactErrorResponse(c, error);
     }
   }
   ```
2. Rewrite every route in `routes/*.ts`. Example transformation for `routes/artifacts.ts:35-45`:
   ```ts
   app.post("/api/artifacts", (c) => handle(c, async () => {
     const principal = await requirePrincipal(c);
     const body = createArtifactInputSchema.parse(await c.req.json());
     const artifact = await getArtifactService().createArtifact(body, principal);
     return { body: artifact, status: 201 };
   }));
   ```
3. For routes that return plain text (e.g. `GET /api/artifacts/:artifactId/content` at `routes/artifacts.ts:96-112`), keep the existing `c.text(...)` call — wrap only the try/catch:
   ```ts
   app.get("/api/artifacts/:artifactId/content", async (c) => {
     try { /* existing body */ } catch (error) { return artifactErrorResponse(c, error); }
   });
   ```
   …OR extend `handle()` to support a `{ text, status, headers }` envelope. Pick one. Document which.
4. Apply the same wrapper to the `/mcp` route in `routes/index.ts:25-31` using `mcpErrorResponse` — create a sibling `handleMcp()` helper in `http/handler.ts` if needed, since MCP uses a different error mapper.

**Acceptance**
- Zero `try { ... } catch (error) { return artifactErrorResponse(c, error); }` blocks remain in `apps/api/src/routes/`. Verify: `grep -rn "artifactErrorResponse(c, error)" apps/api/src/routes/` returns nothing.
- All existing tests in `apps/api/tests/` pass.
- All status codes preserved (201 for POSTs, 200 for GETs, etc).

**Do NOT**
- Change `artifactErrorResponse` itself in this task — that's the existing contract.
- Touch `apps/api/src/http/mcp.ts` internals (separate concern).
- Inline `principal.type !== "user"` checks here — that's T2.

---

### T2 — Replace inline `principal.type !== "user"` checks with `requireHumanPrincipal`

**Files**
- Edit: `apps/api/src/routes/profile.ts`, `apps/api/src/routes/cli.ts`

**Problem**
`http/principal.ts:122-128` already exports `requireHumanPrincipal` that throws `ArtifactForbiddenError("User session required.")`. But three routes manually re-check after calling `requirePrincipal`:
- `routes/profile.ts:13-15` (`/api/profile/me`)
- `routes/profile.ts:27-29` (`/api/profile/username`)
- `routes/cli.ts:22-24` (`/api/cli/authorize`)

Each one returns `c.json({ error: "forbidden", message: "User session required." }, 403)` inline.

**Fix**
In each of those three handlers, replace:
```ts
const principal = await requirePrincipal(c);
if (principal.type !== "user") {
  return c.json({ error: "forbidden", message: "User session required." }, 403);
}
```
with:
```ts
const principal = await requireHumanPrincipal(c);
```
Update imports — `requireHumanPrincipal` is already in `http/principal.ts`. The thrown `ArtifactForbiddenError` is caught by `artifactErrorResponse` → 403, same wire response.

**Acceptance**
- No `principal.type !== "user"` checks left in `apps/api/src/routes/`. Verify: `grep -rn 'principal\.type !== "user"' apps/api/src/routes/` returns nothing.
- Tests pass.

**Do NOT**
- Touch `routes/share-links.ts:95-106` — it already uses `requireHumanPrincipal` correctly.
- Modify `requireHumanPrincipal` itself.

---

### T3 — Move MCP `peek-then-auth` logic out of `handleMcpRequest`

**Files**
- Edit: `apps/api/src/http/mcp.ts`

**Problem**
`apps/api/src/http/mcp.ts:123-164` clones the request body, JSON-parses it twice (once to peek `method`, once inside the auth handler), and branches on whether the method is `initialize` or `tools/list`. The peeked-method fast path uses an anonymous principal; everything else falls through `withMcpAuth`. Hard to read, and `clone().text()` + double-parse is wasteful.

**Fix**
1. Parse the body once at the top:
   ```ts
   const raw = await c.req.raw.clone().text();
   const message = mcpJsonRpcRequestSchema.parse(JSON.parse(raw));
   const isPublicMethod = message.method === "initialize" || message.method === "tools/list";
   ```
2. If `isPublicMethod`, run `handleMcpJsonRpc(message, null)` and return.
3. Otherwise, build a Request from `raw` (or rewind `c.req.raw`) and pass it to `withMcpAuth`. Inside the handler, do not re-parse — pass `message` through.
4. Remove the inner try/catch by reusing the wrapper from T1 (`handleMcp(c, () => ...)`).

**Acceptance**
- No `JSON.parse` called more than once per request.
- `apps/api/tests/mcp-route.test.ts` passes unchanged.

**Do NOT**
- Change the MCP JSON-RPC error code mapping in `mcpErrorPayload`.
- Change `withMcpAuth` behavior — only how we feed it.

---

## ZONE B — Web fetch wrappers (single biggest deletion)

### T4 — Collapse `server-api.ts` into one helper + unify result envelope

**Files**
- Rewrite: `apps/web/lib/server-api.ts`
- Edit: every consumer:
  - `apps/web/app/dashboard/page.tsx`
  - `apps/web/app/[username]/page.tsx`
  - `apps/web/app/[username]/[projectSlug]/page.tsx`
  - `apps/web/app/[username]/[projectSlug]/[slug]/page.tsx`
  - `apps/web/app/[username]/[projectSlug]/[slug]/history/page.tsx`
  - `apps/web/app/[username]/[projectSlug]/[slug]/settings/page.tsx`
  - `apps/web/app/[username]/[projectSlug]/[slug]/audit/page.tsx`
  - `apps/web/app/[username]/[projectSlug]/[slug]/diff/[from]/[to]/page.tsx`
  - `apps/web/app/settings/audit/page.tsx`
  - `apps/web/app/share/[token]/page.tsx`

**Problem**
`apps/web/lib/server-api.ts` is 339 lines of 11 near-identical fetch wrappers. Three problems:
1. Every function rebuilds URL, attaches optional cookie (`HeadersInit = {}` + 5 copies of `if (cookieHeader) headers.cookie = ...`), sets `cache: "no-store"`, branches on `!response.ok`, parses JSON/text. ~30 lines × 11 = ~330 lines of plumbing.
2. **Two incompatible envelope shapes coexist**:
   - `{ status, body?, message? }` — used by `fetchProfileMe`, `fetchOwnedProjects`, `fetchOwnedArtifacts`
   - `{ ok: true, body } | { ok: false, status, message? }` — used by `fetchProjectByPath`, `fetchArtifactMeta`, `fetchArtifactVersions`, etc.
3. Consumers duplicate the same 15-line "404 → notFound / 403 → restricted-page JSX / else throw" pattern in 5 page files. Verify: `grep -l "meta.ok === false && meta.status" apps/web/app -r` returns 5 files.

**Fix**
1. Replace `server-api.ts` with one helper + thin per-endpoint wrappers. Skeleton:
   ```ts
   export type ApiResult<T> =
     | { ok: true; status: number; body: T }
     | { ok: false; status: number; message: string };

   interface ApiCallOptions {
     cookie?: string;
     query?: Record<string, string | number | undefined>;
     method?: "GET" | "POST" | "PATCH" | "DELETE";
     body?: unknown;
     accept?: "json" | "text";
   }

   export function internalApiOrigin(): string {
     return (process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
   }

   export function cookieHeader(cs: { getAll(): { name: string; value: string }[] }): string {
     return cs.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
   }

   async function apiCall<T>(path: string, opts: ApiCallOptions = {}): Promise<ApiResult<T>> {
     const url = new URL(`${internalApiOrigin()}${path}`);
     if (opts.query) for (const [k, v] of Object.entries(opts.query)) {
       if (v !== undefined) url.searchParams.set(k, String(v));
     }
     const headers: Record<string, string> = {};
     if (opts.cookie) headers.cookie = opts.cookie;
     if (opts.body !== undefined) headers["content-type"] = "application/json";

     const response = await fetch(url, {
       method: opts.method ?? "GET",
       headers,
       body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
       cache: "no-store"
     });

     if (!response.ok) {
       const errBody = await response.json().catch(() => ({}));
       return {
         ok: false,
         status: response.status,
         message: (errBody as { message?: string }).message ?? response.statusText
       };
     }

     const body = opts.accept === "text" ? await response.text() : await response.json();
     return { ok: true, status: response.status, body: body as T };
   }
   ```
2. Rewrite all 11 wrappers as one-liners:
   ```ts
   export const fetchProfileMe = (cookie: string) =>
     apiCall<ProfileMeResponse>("/api/profile/me", { cookie });

   export const fetchOwnedProjects = (cookie: string) =>
     apiCall<{ projects: ProjectSummary[] }>("/api/profile/projects", { cookie });

   // ...etc
   ```
3. Add a single helper for the "meta gate" pattern duplicated across 5 pages:
   ```ts
   import { notFound } from "next/navigation";
   export async function loadArtifactGate(
     username: string, projectSlug: string, slug: string, cookie: string | undefined,
     opts: { redirectPath: string }
   ): Promise<
     | { kind: "ok"; meta: ArtifactMeta }
     | { kind: "restricted"; message: string; loginHref: string }
   > {
     const result = await fetchArtifactMeta(username, projectSlug, slug, cookie);
     if (!result.ok && result.status === 404) notFound();
     if (!result.ok && result.status === 403) {
       return {
         kind: "restricted",
         message: result.message,
         loginHref: `/login?next=${encodeURIComponent(opts.redirectPath)}`
       };
     }
     if (!result.ok) throw new Error(`Unexpected artifact response: ${result.status}`);
     return { kind: "ok", meta: result.body };
   }
   ```
4. Update all 5 page files to use `loadArtifactGate`. Example for `[slug]/page.tsx:23-43`:
   ```ts
   const gate = await loadArtifactGate(params.username, params.projectSlug, params.slug, header, { redirectPath: path });
   if (gate.kind === "restricted") return <RestrictedArtifactView message={gate.message} loginHref={gate.loginHref} />;
   const meta = gate.meta;
   ```
   Extract `RestrictedArtifactView` into `apps/web/app/components/restricted-artifact-view.tsx` since it's identical in all 5 places (different only in `loginHref`).

**Acceptance**
- `apps/web/lib/server-api.ts` is under 150 lines.
- `grep -c "if (!response.ok)" apps/web/lib/server-api.ts` returns 1 (just in `apiCall`).
- `grep -rn "meta.ok === false && meta.status" apps/web/app` returns 0 matches.
- `bun run typecheck` passes.
- Manually verify the 5 artifact pages still render: artifact `/u/p/s`, history, settings, audit, diff. Use `apps/web/e2e/smoke.spec.ts` as a starting point.

**Do NOT**
- Change return-shape semantics that callers depend on differently. Pick one envelope (`ApiResult<T>` above) and migrate everything to it.
- Touch `apps/web/lib/server-auth.ts` (separate task — T19).

---

## ZONE C — CLI registry collapse

### T5 — Unify CLI command registry into one source of truth

**Files**
- Edit: `apps/cli/src/program.ts`
- Edit: `apps/cli/src/schema-registry.ts`
- Possibly delete or shrink: `apps/cli/src/api.ts`

**Problem**
Three parallel registries describe the same set of CLI commands:
1. `apps/cli/src/program.ts:35-328` — Commander definitions (383 lines)
2. `apps/cli/src/api.ts:12-136` — HTTP function per command
3. `apps/cli/src/schema-registry.ts:29-226` — declarative `cliCommandSpecs[]` used only by `artifacts schema`

They can silently drift. Drift evidence: `schema-registry.ts:38-42` claims `logout`'s HTTP path is `~/.config/agent-artifacts/credentials.json` with method `DELETE` — a fake HTTP record for a filesystem operation. The hand-written examples in the spec can become wrong without any test catching it.

**Fix**
Design one `CommandSpec` shape that drives both Commander wiring and the `schema` dump.

1. Define in `apps/cli/src/command-spec.ts`:
   ```ts
   import type { ApiClient } from "./client.js";
   import type { CliConfig } from "./config.js";
   import type { NextAction } from "./output.js";
   import type { z } from "zod";

   export interface CommandSpec {
     name: string;                          // "artifact create"
     description: string;
     positional?: { name: string; required: boolean }[];
     options?: { flag: string; description: string; required?: boolean; parse?: (s: string) => unknown }[];
     bodySchema?: z.ZodTypeAny;             // for --json/--json-file input
     http?: { method: "GET" | "POST" | "PATCH" | "DELETE"; pathTemplate: string };  // omit for local-only commands
     mutates: boolean;
     example?: string;
     run: (ctx: RunContext) => Promise<RunResult>;
   }

   export interface RunContext {
     config: CliConfig;
     client: ApiClient;
     positionals: string[];
     options: Record<string, unknown>;
     body?: unknown;          // already parsed against bodySchema
   }

   export interface RunResult {
     data: unknown;
     nextActions?: NextAction[];
     emitRawText?: boolean;   // for `artifact content` text mode
   }
   ```
2. In `apps/cli/src/commands/` (new dir), define one file per command. Example `commands/artifact-create.ts`:
   ```ts
   import { createArtifactInputSchema } from "@agent-artifacts/artifact";
   import type { CommandSpec } from "../command-spec.js";
   import { nextActionsForArtifact } from "../next-actions.js";

   export const artifactCreate: CommandSpec = {
     name: "artifact create",
     description: "Create artifact with first version",
     options: [{ flag: "--json <payload>", description: "JSON body", required: true },
               { flag: "--json-file <path>", description: "Read JSON from file" }],
     bodySchema: createArtifactInputSchema,
     http: { method: "POST", pathTemplate: "/api/artifacts" },
     mutates: true,
     example: 'artifacts artifact create --json \'{"ownerUsername":"alice",...}\'',
     async run({ client, body }) {
       const data = await client.post("/api/artifacts", body);
       return { data, nextActions: nextActionsForArtifact(extractArtifactId(data)) };
     }
   };
   ```
3. In `program.ts`, replace the 280+ lines of `program.command(...).action(...)` calls with a single loop that consumes the spec list:
   ```ts
   import { allCommands } from "./commands/index.js";

   for (const spec of allCommands) {
     const cmd = registerCommandPath(program, spec.name);
     spec.positional?.forEach((p) => cmd.argument(p.required ? `<${p.name}>` : `[${p.name}]`));
     spec.options?.forEach((o) => o.required
       ? cmd.requiredOption(o.flag, o.description)
       : cmd.option(o.flag, o.description, o.parse as never));
     cmd.description(spec.description);
     cmd.action(async (...args) => {
       const opts = args.at(-2) as Record<string, unknown>;
       const cmdObj = args.at(-1) as Command;
       const positionals = args.slice(0, -2) as string[];
       const config = resolveConfig(getGlobalOpts(cmdObj));
       const client = new ApiClient(config);
       const body = spec.bodySchema
         ? spec.bodySchema.parse(parseJsonInput(opts.json as string | undefined, opts.jsonFile as string | undefined))
         : undefined;
       const result = await spec.run({ config, client, positionals, options: opts, body });
       if (result.emitRawText) process.stdout.write(String(result.data));
       else emitSuccess(result.data, config.format, result.nextActions);
     });
   }
   ```
4. Replace `buildAgentSchema()` in `schema-registry.ts` to derive its output from `allCommands` instead of the hand-written `cliCommandSpecs[]`. Delete `cliCommandSpecs`. The `bodySchema` JSON Schema is generated via `z.toJSONSchema(spec.bodySchema)`.
5. `api.ts` can be reduced to or eliminated — most functions become inline `client.METHOD(...)` calls inside each command's `run()`. If you find shared logic (e.g. `getArtifactContent` returning `rawText`), keep just that one.

**Acceptance**
- `apps/cli/src/program.ts` is under 120 lines.
- `apps/cli/src/schema-registry.ts` is under 80 lines and derives entirely from `allCommands`.
- All commands listed in the original `program.ts` still work: `artifacts whoami`, `artifacts artifact create --json ...`, `artifacts artifact content <id>`, `artifacts schema`, `artifacts login`, `artifacts logout`.
- `apps/cli/tests/` all pass.

**Do NOT**
- Migrate `login` and `logout` into the HTTP-driven shape — keep them as `local` commands (omit `http`), since `browserLogin` and `clearStoredCredentials` don't fit the request/response model.
- Change the JSON output envelope (`{ok, data, next_actions}`).
- Touch `apps/cli/src/output.ts`, `client.ts`, or `auth/` in this task.

---

### T6 — Fix top-level argv re-parse in `program.ts` after T5

**Files**
- Edit: `apps/cli/src/program.ts`, `apps/cli/src/cli.ts`

**Problem**
`apps/cli/src/program.ts:330-344` parses argv by hand to detect `--format` for emitting failures on Commander parse errors:
```ts
const format = argv.includes("--format")
  ? (argv[argv.indexOf("--format") + 1] === "json" ? "json" : undefined)
  : undefined;
```
Brittle. Doesn't handle `--format=json` form. Misses `AGENT_ARTIFACTS_FORMAT` env vars. Re-emits a failure then re-throws.

**Fix**
1. After T5 is merged, parse global flags up front (before `parseAsync`) so format is known if Commander throws.
2. Replace the bottom catch with:
   ```ts
   try {
     await program.parseAsync(argv);
   } catch (error) {
     const config = resolveConfig({ format: extractFormatFlag(argv) });
     if (error instanceof CliError) emitFailure(error, config.format);
     if (error instanceof z.ZodError) emitFailure(new CliError("invalid_request", error.message, 2, error.issues), config.format);
     throw error;
   }
   ```
   …where `extractFormatFlag` handles both `--format json` and `--format=json` (one small helper, ~5 lines).
3. `cli.ts` already catches whatever bubbles past `runCli`. Make sure the bottom `throw` is reachable only for non-`CliError`/non-`ZodError` errors (which is current behavior — `emitFailure` is `never`-typed and exits).

**Acceptance**
- `artifacts whoami --format=json` (with equals sign) outputs JSON failures, not plain text.
- Running with `AGENT_ARTIFACTS_FORMAT=json` honors the env.

**Do NOT**
- Block on T5 if T5 isn't done — this task is independent in spirit but easier to do after, since T5 may restructure `runCli`.

---

## ZONE D — MCP dispatch

### T7 — Replace MCP cast-heavy switch with dispatch table

**Files**
- Edit: `packages/mcp/src/index.ts`

**Problem**
`packages/mcp/src/index.ts:100-166` has a `switch (toolName)` where every arm does `parsed as McpToolInput<"name">`. 14 casts because `mcpToolInputSchemas[toolName].parse(input)` loses narrowing. Adding a tool requires touching three lists: `mcpToolInputSchemas`, `mcpToolDescriptions`, and the switch.

**Fix**
1. Define one merged table:
   ```ts
   import type { z } from "zod";
   import type { Principal } from "@agent-artifacts/shared";

   interface ToolDef<S extends z.ZodTypeAny, R> {
     description: string;
     schema: S;
     handler: (input: z.infer<S>, ctx: McpHandlerContext) => Promise<R>;
   }

   const def = <S extends z.ZodTypeAny, R>(d: ToolDef<S, R>) => d;

   export const mcpTools = {
     get_current_principal: def({
       description: "Return the authenticated principal for the current MCP request.",
       schema: z.object({}),
       handler: async (_input, ctx) => ctx.principal
     }),
     create_artifact: def({
       description: "Create a new artifact and immutable first version.",
       schema: createArtifactInputSchema,
       handler: (input, ctx) => ctx.artifactService.createArtifact(input, ctx.principal)
     }),
     // ...rest, in same shape
   } as const;

   export type McpToolName = keyof typeof mcpTools;
   ```
2. Derive `mcpToolInputSchemas` and `mcpToolDescriptions` from `mcpTools` so existing callers (`apps/api/src/http/mcp.ts`) don't break:
   ```ts
   export const mcpToolInputSchemas = Object.fromEntries(
     Object.entries(mcpTools).map(([k, v]) => [k, v.schema])
   ) as { [K in McpToolName]: (typeof mcpTools)[K]["schema"] };
   ```
3. Rewrite `callMcpTool`:
   ```ts
   export async function callMcpTool<T extends McpToolName>(
     toolName: T, input: unknown, context: McpHandlerContext
   ): Promise<unknown> {
     const tool = mcpTools[toolName];
     const parsed = tool.schema.parse(input);
     return (tool.handler as (i: unknown, c: McpHandlerContext) => Promise<unknown>)(parsed, context);
   }
   ```
   Exactly one `as` cast — at the handler call boundary — instead of 14.
4. Rewrite `listMcpTools` to iterate `mcpTools` directly.

**Acceptance**
- Zero `as McpToolInput<"...">` casts in `packages/mcp/src/index.ts`.
- `packages/mcp/tests/mcp-tools.test.ts` passes unchanged.
- `apps/api/tests/mcp-route.test.ts` passes unchanged.

**Do NOT**
- Change the public `McpToolName` type or the wire shape of any tool's input/output.
- Touch `apps/api/src/http/mcp.ts` in this task (it consumes `mcpToolInputSchemas` and `callMcpTool` — both should still work).

---

## ZONE E — Decompose 944-line god module

### T8 — Split `packages/artifact/src/index.ts`

**Files**
- Edit: `packages/artifact/src/index.ts` (becomes a barrel)
- Create: `packages/artifact/src/artifact-types.ts`
- Create: `packages/artifact/src/artifact-service.ts`
- Create: `packages/artifact/src/drizzle-artifact-repository.ts`
- Create: `packages/artifact/src/slug.ts`
- Update tests in `packages/artifact/tests/artifact-service.test.ts` only if import paths break (the public package exports should not change).

**Problem**
`packages/artifact/src/index.ts` is 944 lines containing: schemas, type aliases, error classes, the `ArtifactService` class (440 lines), the `DrizzleArtifactRepository` class (220 lines), the `validateSlug` helper (used internally at L244 but defined at L922), and a re-export hub. Sibling files (`project.ts`, `profile-service.ts`, `share-link-service.ts`, `audit-service.ts`, `drizzle-role-resolver.ts`) prove the shape. This file just never got decomposed.

**Fix**
1. Move into `artifact-types.ts`:
   - Schemas: `artifactAccessInputSchema`, `artifactContentSchema`, `createArtifactInputSchema`, `updateArtifactInputSchema`, `setArtifactAccessInputSchema`
   - Type exports: `CreateArtifactInput`, `UpdateArtifactInput`, `SetArtifactAccessInput`, `ArtifactAccessSnapshot`, `ArtifactSummary`, `ArtifactRecord`, `ArtifactVersionRecord`, `ArtifactRepository`, `ReplaceArtifactEmailAccessInput`, `PersistCreateArtifactInput`, `PersistCreateVersionInput`, `PersistAuditEventInput`
   - Error classes: `SlugUnavailableError`, `ArtifactNotFoundError`, `ArtifactConflictError`
   - Constant: `MAX_ARTIFACT_CONTENT_BYTES`
   - Helper: `contentTypeForArtifact`
2. Move into `slug.ts`:
   - `validateSlug` (currently at L922) — also used by `project.ts` indirectly.
3. Move into `artifact-service.ts`:
   - The `ArtifactService` class only.
4. Move into `drizzle-artifact-repository.ts`:
   - The `DrizzleArtifactRepository` class only.
5. Rewrite `index.ts` to be a barrel under 60 lines that re-exports everything currently exported by the package. Make sure to preserve every name the rest of the codebase imports — start by running `grep -rn "from \"@agent-artifacts/artifact\"" .` to get the exhaustive list of imported names before refactor.

**Acceptance**
- New `packages/artifact/src/index.ts` is under 60 lines.
- No file in `packages/artifact/src/` exceeds 500 lines.
- `bun run typecheck` passes across the monorepo.
- `bun run test` passes.
- `grep -rn "from \"@agent-artifacts/artifact\"" .` results have the same imported names before and after.

**Do NOT**
- Change any class behavior or method signatures.
- Rename any exported symbol.
- Move the `project.ts`, `profile-service.ts`, `share-link-service.ts`, `audit-service.ts`, `drizzle-role-resolver.ts` files — those are already correctly decomposed.

---

## ZONE F — Helper dedup in `packages/artifact` + `packages/access` + `packages/policy`

### T9 — Deduplicate `DrizzleArtifactRepository` and `DrizzleProjectRepository` owner-lookup logic

**Files**
- Edit: `packages/artifact/src/index.ts` (or `drizzle-artifact-repository.ts` post-T8)
- Edit: `packages/artifact/src/project.ts`
- Create: `packages/artifact/src/drizzle-owner-lookup.ts`

**Problem**
`getOwnerByUsername` is implemented byte-identically twice:
- `packages/artifact/src/index.ts:675-687`
- `packages/artifact/src/project.ts:185-197`

Same for `getProjectByOwnerSlug` (`index.ts:689-702` vs `project.ts:209-216`). The `requireOwner` helpers on both services (`index.ts:572-579`, `project.ts:172-179`) differ only in which `NotFoundError` they throw.

**Fix**
1. Create `packages/artifact/src/drizzle-owner-lookup.ts`:
   ```ts
   import { eq, sql } from "drizzle-orm";
   import type { Database } from "@agent-artifacts/db";
   import { userProfiles, projects } from "@agent-artifacts/db";

   export async function getOwnerByUsername(db: Database, username: string) {
     const normalized = username.trim().toLowerCase();
     const [owner] = await db
       .select({ userId: userProfiles.userId, username: userProfiles.username })
       .from(userProfiles)
       .where(sql`lower(${userProfiles.username}) = ${normalized}`)
       .limit(1);
     return owner;
   }

   export async function getProjectIdByOwnerSlug(db: Database, username: string, projectSlug: string) {
     // ...identical query body extracted from both repos
   }
   ```
2. Have both `DrizzleArtifactRepository.getOwnerByUsername` and `DrizzleProjectRepository.getOwnerByUsername` call the shared helper. Same for `getProjectByOwnerSlug` (keep separate methods that satisfy each interface, but delegate).
3. Leave each service's `requireOwner` method alone — different `NotFoundError` types are part of the public contract.

**Acceptance**
- Diff between `DrizzleArtifactRepository.getOwnerByUsername` and `DrizzleProjectRepository.getOwnerByUsername` shrinks to just delegation.
- All artifact + project tests pass.

**Do NOT**
- Merge `ArtifactRepository` and `ProjectRepository` interfaces — they're correctly separated.
- Change `requireOwner` to throw a unified error.

---

### T10 — Single canonical `roleRank` table

**Files**
- Edit: `packages/policy/src/index.ts`
- Edit: `packages/access/src/index.ts`

**Problem**
Identical `roleRank` mappings:
- `packages/policy/src/index.ts:8-13`
- `packages/access/src/index.ts:75-80` (inside `highestRole`)

**Fix**
1. Export `roleRank` (and `hasRole`) from `packages/policy/src/index.ts` (already exported).
2. In `packages/access/src/index.ts`, import `roleRank` from `@agent-artifacts/policy` and remove the local copy:
   ```ts
   import { roleRank } from "@agent-artifacts/policy";
   ```
3. Verify `package.json` for `@agent-artifacts/access` already lists `@agent-artifacts/policy` as a dependency. If not, add it.

**Acceptance**
- Only one definition of `roleRank` in the monorepo. Verify: `grep -rn "roleRank" packages/` shows imports + one definition only.
- All access + policy tests pass.

**Do NOT**
- Move `hasRole` between packages — `policy` is the canonical home.

---

## ZONE G — Cookie reader + share-session collapse (T12 → T11)

Run **T12 before T11**. T12 extracts `readCookie` from `apps/api/src/share-session.ts`; T11 deletes that file and wires `ShareLinkService.resolveCookieGrant`.

### T12 — Single cookie reader

**Files**
- Create: `packages/shared/src/cookie.ts` (or use `hono/cookie`'s `getCookie` if dependencies allow)
- Edit: `apps/api/src/cli-auth.ts`, `apps/api/src/share-session.ts`
- Edit: `apps/api/src/routes/cli.ts` (call site for session cookie parsing)

**Problem**
Three cookie parsers exist:
- `apps/api/src/share-session.ts:49-59` `readCookie`
- `apps/api/src/cli-auth.ts:48-61` `parseSessionTokenFromCookie`
- `apps/web/lib/server-api.ts:5-7` `cookieHeader` (this one builds, not parses — leave alone)

**Fix**
1. Decide between:
   - Option A: Use `hono/cookie`'s `getCookie(c, name)` directly. Best for hono-aware code, but only inside hono handlers.
   - Option B: Add a tiny `readCookie(header: string | null | undefined, name: string): string | undefined` to `packages/shared/src/cookie.ts`. Best for code that has a raw header (`ShareLinkService.resolveCookieGrant`, web middleware).
2. Recommended: do both. Use `getCookie` inside route handlers; use the shared helper in the service layer and web middleware.
3. Replace `parseSessionTokenFromCookie(cookieHeader)` with `readCookie(cookieHeader, "better-auth.session_token")` inline at the call site (`routes/cli.ts:27`).
4. Delete `parseSessionTokenFromCookie` from `cli-auth.ts`. Leave the standalone `readCookie` in `share-session.ts` until T11 deletes the file.

**Acceptance**
- `grep -rn "function readCookie\|function parseSessionTokenFromCookie" apps packages` shows at most one definition.

**Do NOT**
- Touch the cookie-building `cookieHeader(cookieStore)` in `server-api.ts` — that's a different (correct) helper.
- Delete `apps/api/src/share-session.ts` — that is T11.

---

### T11 — Move cookie share-grant resolution into `ShareLinkService`

**Prerequisite:** T12 (shared `readCookie` in `packages/shared/src/cookie.ts`).

**Files**
- Delete: `apps/api/src/share-session.ts`
- Edit: `packages/artifact/src/share-link-service.ts`
- Edit: `apps/api/src/http/principal.ts`

**Problem**
`apps/api/src/share-session.ts:20-47` duplicates the query logic in `ShareLinkService.resolveActiveShareLink` (`packages/artifact/src/share-link-service.ts:101-121`). Same select, same expiry check, same `hashShareToken` call (defined in both files: `share-session.ts:31` and `share-link-service.ts:124`). The only differences in `share-session.ts` are reading the cookie + checking `link.artifactId === artifactId`.

The canonical service should own this. Right now the API app keeps its own copy that will drift the next time the `shareLinks` schema changes.

**Fix**
1. Add to `ShareLinkService`:
   ```ts
   async resolveCookieGrant(cookieHeader: string | null | undefined, artifactId: string): Promise<{ shareLinkId: string; role: ShareLinkRole } | null> {
     if (!cookieHeader) return null;
     const token = readCookie(cookieHeader, `aa_share_${artifactId}`);
     if (!token) return null;
     const tokenHash = hashShareToken(token);
     const [link] = await this.db
       .select()
       .from(shareLinks)
       .where(and(eq(shareLinks.tokenHash, tokenHash), isNull(shareLinks.revokedAt)))
       .limit(1);
     if (!link || link.artifactId !== artifactId) return null;
     if (link.expiresAt && link.expiresAt < new Date()) return null;
     return { shareLinkId: link.id, role: link.role === "editor" ? "editor" : "viewer" };
     // NOTE: role narrowing here is removed by T17 once the share_link_role enum lands
   }
   ```
   Import `readCookie` from `@agent-artifacts/shared` (added in T12).
2. Update `apps/api/src/http/principal.ts:61` to call `getShareLinkService().resolveCookieGrant(c.req.header("cookie"), artifactId)` instead of the standalone `resolveShareGrant`.
3. Delete `apps/api/src/share-session.ts`.

**Acceptance**
- `apps/api/src/share-session.ts` no longer exists.
- `apps/api/tests/security.test.ts` (covers share-link grant) passes.

**Do NOT**
- Re-inline a local `readCookie` — use the T12 shared helper.

---

## ZONE H — Rate limit IP spoofing

### T13 — Gate all proxy IP headers behind `TRUST_PROXY`

**Files**
- Edit: `apps/api/src/rate-limit.ts`

**Problem**
`apps/api/src/rate-limit.ts:53-72` reads `cf-connecting-ip` and `x-real-ip` unconditionally. Only `x-forwarded-for` is gated by `TRUST_PROXY === "true"`. Behind a non-Cloudflare proxy (or no proxy at all), an attacker can send `X-Real-IP: <victim>` to set their rate-limit bucket to any IP they want and exhaust someone else's budget — or evade rate limits by rotating fake IPs.

**Fix**
Gate all three behind the same trust flag. Suggested clientIp:
```ts
function clientIp(c: Context): string {
  if (process.env.TRUST_PROXY !== "true") return "direct";  // fall back to a single global bucket in dev
  const cf = c.req.header("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = c.req.header("x-real-ip");
  if (real) return real.trim();
  const fwd = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return fwd;
  return "unknown";
}
```
Optionally support `TRUST_PROXY=cloudflare` to enable only `cf-connecting-ip`.

Document `TRUST_PROXY` in `.env.example`.

**Acceptance**
- With `TRUST_PROXY` unset, sending `X-Real-IP: 1.2.3.4` does NOT change the rate-limit bucket key.
- Add a test in `apps/api/tests/` that asserts: with `TRUST_PROXY` unset, two requests from same socket but different `X-Real-IP` headers share the rate-limit budget.

**Do NOT**
- Replace the in-process `Map` with Redis — separate scaling concern.
- Change `windowMs` / `max` defaults.

---

## ZONE I — Project service authz

### T14 — `ProjectService.getProjectByPath` must go through the access layer

**Files**
- Edit: `packages/artifact/src/project.ts`

**Problem**
`packages/artifact/src/project.ts:133-144` uses `actsForOwner(principal, project.ownerUserId)` directly instead of `this.access.assertAuthorized(...)`. Inconsistent with every other service method, and means an admin role grant (or future namespace-level admin role) won't reach a project read.

**Fix**
Replace the direct `actsForOwner` check with:
```ts
await this.access.assertAuthorized({
  principal,
  action: "artifact.view",   // closest existing action; or add "project.view" to the action enum
  context: { kind: "namespace", ownerUserId: project.ownerUserId }
});
```
If the policy doesn't currently allow `artifact.view` in namespace context, this is a sign the project-read action needs its own row in `actionMinimumRole` (`packages/policy/src/index.ts:15-29`). Add `"project.view": "viewer"` if so, and extend `artifactActionSchema` accordingly in `packages/shared/src/index.ts`.

**Acceptance**
- No direct `actsForOwner` calls in `project.ts`'s public methods (helpers in `access` package are fine).
- All project tests pass; add one if missing for "admin can read non-owned project".

**Do NOT**
- Touch `getProjectByPathForListing` here — that's T15.

---

### T15 — Move "list-or-hide" logic out of `getProjectByPathForListing`

**Files**
- Edit: `packages/artifact/src/project.ts`
- Edit: `apps/api/src/routes/profile.ts`

**Problem**
`packages/artifact/src/project.ts:146-162` takes `visibleArtifactCount: number` as a parameter so it can decide between throwing `ArtifactForbiddenError` or `ProjectNotFoundError`. That's a presentation concern leaking into a getter. Caller (`apps/api/src/routes/profile.ts:62-79`) already has both pieces — it can do the gating itself.

**Fix**
1. Add a clean `ProjectService.getProjectByPathRaw(username, projectSlug): Promise<ProjectRecord>` that just looks up and throws `ProjectNotFoundError` if missing — no authz, no visibility logic.
2. In `routes/profile.ts:62-79`, do:
   ```ts
   const project = await getProjectService().getProjectByPathRaw(username, projectSlug);
   const projectArtifacts = await getArtifactService().listArtifactsInProject(username, projectSlug, principal);
   const isOwner = actsForOwner(principal, project.ownerUserId);   // helper from @agent-artifacts/access
   if (!isOwner && projectArtifacts.length === 0) throw new ProjectNotFoundError();
   return c.json({ project, artifacts: projectArtifacts });
   ```
3. Delete `getProjectByPathForListing`.

**Acceptance**
- `getProjectByPathForListing` no longer exists.
- Existing behavior preserved: a non-owner seeing a project with zero visible artifacts gets 404, not 200-with-empty-list.

**Do NOT**
- Combine the project lookup with the artifact list into a single query — keep them separate calls (the artifact list does its own authz filtering per-artifact).

---

## ZONE J — Auth gating consistency

### T16 — Pick one layer for auth-protected page enforcement

**Files**
- Edit: `apps/web/proxy.ts`
- Audit (read-only first): all pages matched by the new middleware

**Problem**
`apps/web/proxy.ts:5-11` regex-matches `/[^/]+/[^/]+/[^/]+/(settings|audit|history)` and also `/dashboard` + `/settings`. Then individual pages (`apps/web/app/[username]/[projectSlug]/[slug]/settings/page.tsx:39-41`, history, audit, diff) re-implement their own auth gates. Two layers, both fallible, both add latency.

**Fix**
Decide one layer of truth. Two valid choices:

**Option A (recommended):** keep middleware as a coarse redirect-to-login filter only. Pages still call `fetchArtifactMeta` and handle 401/403/404 like they do today. Drop the regex complexity in `proxy.ts`:
```ts
function needsAuthProtection(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/settings");
}
```
The deeper pages handle their own gating (and have to, because of partial-visibility cases like share-link viewers).

**Option B:** push the per-page auth check entirely into middleware. Hard to do cleanly because share-link grants are per-artifact and the middleware doesn't know which artifact.

Pick A. Document the decision in the file as a one-liner comment (max).

**Acceptance**
- `apps/web/proxy.ts` is under 25 lines.
- Pages still render correctly when logged out for public artifacts.

**Do NOT**
- Remove the page-level gates (T4's `loadArtifactGate`) — they're load-bearing.

---

## ZONE K — Share-link role enum tightness

### T17 — Separate `share_link_role` DB enum and remove ternary narrowing

**Files**
- Edit: `packages/db/src/schema.ts`
- Add migration: `packages/db/drizzle/<timestamp>_share_link_role_enum.sql`
- Edit: `packages/artifact/src/share-link-service.ts`
- Edit: `apps/api/src/routes/share-links.ts`

**Problem**
`packages/db/src/schema.ts:246` types `shareLinks.role` as `artifactRole` (4-value enum: owner|admin|editor|viewer). `ShareLinkRole` is only `viewer|editor`. So every read of the column has a ternary narrowing:
- `packages/artifact/src/share-link-service.ts:88`
- `apps/api/src/routes/share-links.ts:116`

This is the root cause. Tighten the column type.

**Fix**
1. Add a new pgEnum:
   ```ts
   export const shareLinkRole = pgEnum("share_link_role", ["viewer", "editor"]);
   ```
2. Generate a migration that:
   - Creates the new enum type.
   - Adds a check constraint or temporary column, copies values, drops old column, renames new column. Standard PG enum-narrowing dance — drizzle-kit may need a hand-written SQL migration.
3. Update `shareLinks.role` definition to use `shareLinkRole("role").notNull()`.
4. Remove every `link.role === "editor" ? "editor" : "viewer"` ternary.
5. Run `bun run db:generate` and verify the migration applies cleanly against a fresh DB.

**Acceptance**
- `grep -rn '=== "editor" ? "editor" : "viewer"' .` returns 0 matches.
- `bun run db:migrate` succeeds against an empty DB.
- `bun run test` passes.

**Do NOT**
- Drop the old `artifactRole` enum (still used by `artifactPermissions.role`).
- Skip the migration — schema changes must be migratable.

---

## ZONE L — Custom env loader

### T18 — Replace `load-monorepo-env.ts` with a battle-tested loader

**Files**
- Delete: `packages/config/src/load-monorepo-env.ts`
- Edit: `packages/config/src/index.ts`
- Edit: `apps/api/src/load-env.ts`
- Edit: `apps/web/next.config.ts`

**Problem**
`packages/config/src/load-monorepo-env.ts` is 82 lines reimplementing dotenv. Includes quote stripping, monorepo-root discovery via package.json walk, and `.env.local` override. Bun has `--env-file` natively. `dotenv` solves this in zero LoC.

**Fix**
1. Add `dotenv` to devDependencies of the root `package.json`.
2. Replace `loadMonorepoEnv()` body with:
   ```ts
   import { config as dotenvConfig } from "dotenv";
   import { existsSync } from "node:fs";
   import { dirname, join } from "node:path";

   export function loadMonorepoEnv(startDir = process.cwd()): void {
     const root = findRoot(startDir);
     if (!root) return;
     if (existsSync(join(root, ".env"))) dotenvConfig({ path: join(root, ".env") });
     if (existsSync(join(root, ".env.local"))) dotenvConfig({ path: join(root, ".env.local"), override: true });
   }
   ```
3. Keep `findMonorepoRoot` (the package.json walk) — that's project-specific and worth ~10 lines.

**Acceptance**
- `packages/config/src/load-monorepo-env.ts` is under 25 lines.
- `bun dev` (from any subdirectory) still picks up `.env` from the repo root.

**Do NOT**
- Change the *public* API (`loadMonorepoEnv()` signature must stay).
- Replace with Bun's `--env-file` everywhere — Next.js + bun + node CLI all have different env loading; centralizing in this helper is still useful.

---

## ZONE M — Auth/db singleton duplication across apps

### T19 — Decide how web checks sessions without spawning a duplicate auth handle

**Files**
- Edit: `apps/web/lib/server-auth.ts`
- Possibly edit: `apps/web/proxy.ts`

**Problem**
`apps/web/lib/server-auth.ts:8-33` defines `getDb()` and `getAuth()` byte-identically to `apps/api/src/deps.ts:29-54`. The web Next process therefore spawns a second better-auth instance and a second DB pool just to answer "is this cookie a valid session?" in middleware.

**Fix**
Decision required (ASK USER if unsure):

**Option A:** add a `GET /api/auth/_session-check` route in the API app that returns `{ authenticated: boolean }` with `cache-control: no-store`. Have `hasAuthenticatedSession` in `server-auth.ts` call it via internal-origin fetch. Pro: single source of truth. Con: one extra HTTP roundtrip per gated page.

**Option B:** extract the common bootstrap into a shared `@agent-artifacts/runtime` package exporting `getDb()` and `getAuth()`. Pro: zero extra hop. Con: web process really does have two DB pools (one for its own queries, one for shared runtime) unless we accept that better-auth in web is the right design.

**Option C:** leave as-is and document it. The duplication is OK because better-auth is per-process and there's only one DB pool per process anyway. The real waste is 25 lines.

Recommend **Option C** unless this becomes a real ops problem — accept the duplication and add a comment to both files explaining why they're parallel. If accepting C, this task is just documentation.

Otherwise: implement A, and check `apps/web/e2e/smoke.spec.ts` still passes for logged-in flows.

**Acceptance**
- Decision documented in the file picked.
- Or: middleware no longer instantiates a second better-auth handle.

**Do NOT**
- Touch `apps/api/src/deps.ts` lifecycle (it's the authoritative bootstrap for the API process).

---

## Cross-cutting nits (small, optional, no blocker)

These don't justify their own zone; pick up at the end of related work if convenient.

- **`apps/cli/src/program.ts:73-79`** — `whoami` doesn't `return` after `emitFailure`. Works only because `emitFailure` is `never`-typed. Add the `return;` for readability after T5.
- **`apps/web/app/components/access-settings-form.tsx`, `share-links-manager.tsx`, `delete-artifact-button.tsx`, `claim-username-form.tsx`, `cli-login-authorize.tsx`** — all duplicate the same `fetch → !ok → setError(body.message)` pattern. After T4 lands, extract `useMutation(url, opts)` or a `mutate()` helper if you do another sweep.
- **`packages/shared/src/index.ts:115-123`** — `buildProjectArtifactUrl` and `buildProjectUrl` differ only in the appended path segment. Trivial dedup but not worth a task.

---

## Suggested execution order (for human dispatcher)

1. Kick off in parallel: T1 (Zone A), T4 (Zone B), T7 (Zone D), T8 (Zone E), T13 (Zone H), T18 (Zone L).
2. After T1 lands: T2, T3.
3. After T4 lands: the small UI mutation-helper nit.
4. After T8 lands: T9 (touches freshly-split artifact files).
5. Zone G: run T12 then T11 sequentially (T12 extracts `readCookie` from `apps/api/src/share-session.ts`; T11 deletes that file).
6. T5 (CLI registry) is the most invasive single task; assign your most capable agent. T6 follows.
7. T17 (DB enum) needs a real migration — pair with a human review of the SQL before applying to prod.

Approximate net deletion: **~900 lines** across the codebase, with no behavior change.
