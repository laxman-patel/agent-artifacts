import { Command } from "commander";
import { buildAgentSchema } from "./schema-registry.js";
import { resolveConfig, type OutputFormat } from "./config.js";
import { ApiClient } from "./client.js";
import { CliError } from "./errors.js";
import { emitFailure, emitSuccess } from "./output.js";
import { invokeMcpTool, isMcpToolName } from "./invoke.js";
import { parseJsonInput } from "./json-input.js";
import type { NextAction } from "./output.js";

interface GlobalOpts {
  baseUrl?: string;
  token?: string;
  format?: OutputFormat;
  quiet?: boolean;
}

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("aa")
    .description("Agent-friendly CLI for agent-artifacts (MCP + REST API parity)")
    .option("--base-url <url>", "API base URL (env: AGENT_ARTIFACTS_BASE_URL)")
    .option("--token <token>", "Bearer token (env: AGENT_ARTIFACTS_TOKEN)")
    .option("--format <format>", "Output format: json or text", (value) => value as OutputFormat)
    .option("-q, --quiet", "Suppress stderr progress messages")
    .showHelpAfterError("(add --help for command list; use `aa schema` for machine-readable capabilities)");

  program
    .command("schema")
    .description("Print machine-readable CLI capabilities for agents (JSON)")
    .action((_opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      emitSuccess(buildAgentSchema(), "json");
      void config;
    });

  program
    .command("invoke <tool>")
    .description("Run an MCP tool by snake_case name (e.g. create_artifact)")
    .option("--json <payload>", "JSON input object")
    .option("--json-file <path>", "Read JSON input from a file")
    .action(async (tool: string, opts: { json?: string; jsonFile?: string }, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      if (!isMcpToolName(tool)) {
        throw new CliError("invalid_request", `Unknown MCP tool: ${tool}. Run \`aa schema\` for valid names.`, 2);
      }
      const client = new ApiClient(config);
      const input =
        opts.jsonFile !== undefined
          ? parseJsonInput(undefined, opts.jsonFile)
          : opts.json !== undefined
            ? parseJsonInput(opts.json, undefined)
            : {};
      const data = await invokeMcpTool(client, tool, input);
      emitSuccess(data, config.format);
    });

  program
    .command("health")
    .description("Check API health")
    .action(async (_opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await new ApiClient(config).get<{ ok: boolean }>("/health");
      emitSuccess(data, config.format);
    });

  const principal = program.command("principal").description("Authentication / principal");
  principal
    .command("get")
    .description("Get current principal (maps to MCP get_current_principal)")
    .action(async (_opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await invokeMcpTool(new ApiClient(config), "get_current_principal", {});
      emitSuccess(data, config.format);
    });

  const project = program.command("project").description("Projects");
  project
    .command("list")
    .description("List owned projects")
    .action(async (_opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await invokeMcpTool(new ApiClient(config), "list_projects", {});
      emitSuccess(data, config.format);
    });
  project
    .command("create")
    .description("Create a project")
    .requiredOption("--json <payload>", "JSON body")
    .option("--json-file <path>", "Read JSON from file")
    .action(async (opts: { json?: string; jsonFile?: string }, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const body = parseJsonInput(opts.json, opts.jsonFile);
      const data = await invokeMcpTool(new ApiClient(config), "create_project", body);
      emitSuccess(data, config.format, nextActionsForProject(data));
    });
  project
    .command("slug-availability <owner> <slug>")
    .description("Check project slug availability")
    .action(async (owner: string, slug: string, _opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await invokeMcpTool(new ApiClient(config), "check_project_slug_availability", {
        ownerUsername: owner,
        slug
      });
      emitSuccess(data, config.format);
    });

  const artifact = program.command("artifact").description("Artifacts");
  artifact
    .command("list")
    .description("List owned artifacts")
    .action(async (_opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await invokeMcpTool(new ApiClient(config), "list_artifacts", {});
      emitSuccess(data, config.format);
    });
  artifact
    .command("get <artifactId>")
    .description("Get artifact metadata")
    .action(async (artifactId: string, _opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await invokeMcpTool(new ApiClient(config), "get_artifact", { artifactId });
      emitSuccess(data, config.format, nextActionsForArtifact(artifactId));
    });
  artifact
    .command("create")
    .description("Create artifact with first version")
    .requiredOption("--json <payload>", "JSON body")
    .option("--json-file <path>", "Read JSON from file")
    .action(async (opts: { json?: string; jsonFile?: string }, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const body = parseJsonInput(opts.json, opts.jsonFile);
      const data = await invokeMcpTool(new ApiClient(config), "create_artifact", body);
      emitSuccess(data, config.format, nextActionsForArtifact(extractArtifactId(data)));
    });
  artifact
    .command("update <artifactId>")
    .description("Append a new artifact version")
    .requiredOption("--json <payload>", "JSON body (content, optional changelog)")
    .option("--json-file <path>", "Read JSON from file")
    .action(async (artifactId: string, opts: { json?: string; jsonFile?: string }, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const body = parseJsonInput(opts.json, opts.jsonFile) as Record<string, unknown>;
      const data = await invokeMcpTool(new ApiClient(config), "update_artifact", { artifactId, ...body });
      emitSuccess(data, config.format, nextActionsForArtifact(artifactId));
    });
  artifact
    .command("delete <artifactId>")
    .description("Soft-delete an artifact")
    .action(async (artifactId: string, _opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await invokeMcpTool(new ApiClient(config), "delete_artifact", { artifactId });
      emitSuccess(data, config.format);
    });
  artifact
    .command("content <artifactId>")
    .description("Get artifact source content")
    .option("--version <n>", "Version number", (v) => Number.parseInt(v, 10))
    .action(async (artifactId: string, opts: { version?: number }, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const result = await invokeMcpTool(new ApiClient(config), "get_artifact_content", {
        artifactId,
        versionNumber: opts.version
      });
      const content = (result as { content: string }).content;
      if (config.format === "json") {
        emitSuccess({ artifactId, version: opts.version ?? "latest", content }, config.format);
      } else {
        process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
      }
    });
  artifact
    .command("versions <artifactId>")
    .description("List artifact versions")
    .option("--limit <n>", "Max versions", (v) => Number.parseInt(v, 10))
    .action(async (artifactId: string, opts: { limit?: number }, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await invokeMcpTool(new ApiClient(config), "list_artifact_versions", {
        artifactId,
        limit: opts.limit
      });
      emitSuccess(data, config.format);
    });
  artifact
    .command("diff <artifactId>")
    .description("Diff two artifact versions")
    .requiredOption("--from <n>", "From version", (v) => Number.parseInt(v, 10))
    .requiredOption("--to <n>", "To version", (v) => Number.parseInt(v, 10))
    .action(async (artifactId: string, opts: { from: number; to: number }, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await invokeMcpTool(new ApiClient(config), "diff_artifact_versions", {
        artifactId,
        fromVersion: opts.from,
        toVersion: opts.to
      });
      emitSuccess(data, config.format);
    });
  artifact
    .command("slug-availability <owner> <project> <slug>")
    .description("Check artifact slug availability in a project")
    .action(async (owner: string, projectSlug: string, slug: string, _opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await invokeMcpTool(new ApiClient(config), "check_slug_availability", {
        ownerUsername: owner,
        projectSlug,
        slug
      });
      emitSuccess(data, config.format);
    });
  artifact
    .command("url-preview <owner> <project> <slug>")
    .description("Preview public artifact URL")
    .action(async (owner: string, projectSlug: string, slug: string, _opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await new ApiClient(config).get<{ url: string }>(
        `/api/slug-preview/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`
      );
      emitSuccess(data, config.format);
    });

  const access = artifact.command("access").description("Artifact access settings");
  access
    .command("get <artifactId>")
    .description("Get access settings")
    .action(async (artifactId: string, _opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await invokeMcpTool(new ApiClient(config), "get_artifact_access", { artifactId });
      emitSuccess(data, config.format);
    });
  access
    .command("set <artifactId>")
    .description("Update access settings")
    .requiredOption("--json <payload>", "JSON access body")
    .option("--json-file <path>", "Read JSON from file")
    .action(async (artifactId: string, opts: { json?: string; jsonFile?: string }, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const accessBody = parseJsonInput(opts.json, opts.jsonFile);
      const data = await invokeMcpTool(new ApiClient(config), "set_artifact_access", {
        artifactId,
        access: accessBody
      });
      emitSuccess(data, config.format);
    });

  const profile = program.command("profile").description("User profile (API)");
  profile
    .command("get")
    .description("Get profile (alias for principal get)")
    .action(async (_opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await new ApiClient(config).get("/api/profile/me");
      emitSuccess(data, config.format);
    });
  profile
    .command("set-username")
    .description("Set username once for a new account")
    .requiredOption("--json <payload>", 'JSON e.g. {"username":"alice"}')
    .option("--json-file <path>", "Read JSON from file")
    .action(async (opts: { json?: string; jsonFile?: string }, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const body = parseJsonInput(opts.json, opts.jsonFile);
      const data = await new ApiClient(config).post("/api/profile/username", body);
      emitSuccess(data, config.format);
    });

  const pathCmd = program.command("path").description("Resolve resources by URL path");
  pathCmd
    .command("project <owner> <projectSlug>")
    .description("Get project and artifacts by path")
    .action(async (owner: string, projectSlug: string, _opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await new ApiClient(config).get(
        `/api/by-path/${encodeURIComponent(owner)}/projects/${encodeURIComponent(projectSlug)}`
      );
      emitSuccess(data, config.format);
    });
  pathCmd
    .command("artifact <owner> <projectSlug> <slug>")
    .description("Get artifact by path")
    .action(async (owner: string, projectSlug: string, slug: string, _opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await new ApiClient(config).get(
        `/api/by-path/${encodeURIComponent(owner)}/projects/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`
      );
      emitSuccess(data, config.format, nextActionsForArtifact(extractArtifactId(data)));
    });

  const share = program.command("share").description("Share links (API)");
  share
    .command("create <artifactId>")
    .description("Create a share link")
    .requiredOption("--json <payload>", 'JSON e.g. {"role":"viewer"}')
    .option("--json-file <path>", "Read JSON from file")
    .action(async (artifactId: string, opts: { json?: string; jsonFile?: string }, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const body = parseJsonInput(opts.json, opts.jsonFile);
      const data = await new ApiClient(config).post(`/api/artifacts/${encodeURIComponent(artifactId)}/share-links`, body);
      emitSuccess(data, config.format);
    });
  share
    .command("list <artifactId>")
    .description("List share links")
    .action(async (artifactId: string, _opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await new ApiClient(config).get(`/api/artifacts/${encodeURIComponent(artifactId)}/share-links`);
      emitSuccess(data, config.format);
    });
  share
    .command("revoke <shareLinkId>")
    .description("Revoke a share link")
    .action(async (shareLinkId: string, _opts, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await new ApiClient(config).post(`/api/share-links/${encodeURIComponent(shareLinkId)}/revoke`, {});
      emitSuccess(data, config.format);
    });

  const audit = program.command("audit").description("Audit log (API)");
  audit
    .command("list")
    .description("List audit events")
    .option("--artifact-id <id>", "Filter by artifact")
    .option("--limit <n>", "Max events", (v) => Number.parseInt(v, 10))
    .action(async (opts: { artifactId?: string; limit?: number }, cmd) => {
      const config = resolveConfig(getGlobalOpts(cmd));
      const data = await new ApiClient(config).get("/api/audit-events", {
        artifactId: opts.artifactId,
        limit: opts.limit
      });
      emitSuccess(data, config.format);
    });

  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof CliError) {
      const config = resolveConfig({});
      emitFailure(error, config.format);
    }
    throw error;
  }
}

function getGlobalOpts(cmd: Command): GlobalOpts {
  const opts = cmd.optsWithGlobals() as GlobalOpts & Record<string, unknown>;
  return {
    baseUrl: opts.baseUrl,
    token: opts.token,
    format: opts.format,
    quiet: opts.quiet
  };
}

function extractArtifactId(data: unknown): string | undefined {
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    if (typeof record.artifactId === "string") return record.artifactId;
    if (typeof record.id === "string") return record.id;
  }
  return undefined;
}

function nextActionsForArtifact(artifactId: string | undefined): NextAction[] | undefined {
  if (!artifactId) return undefined;
  return [
    { command: `aa artifact get ${artifactId}`, description: "Read artifact metadata" },
    { command: `aa artifact content ${artifactId}`, description: "Read latest content" },
    { command: `aa artifact versions ${artifactId}`, description: "List versions" }
  ];
}

function nextActionsForProject(data: unknown): NextAction[] | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const record = data as Record<string, unknown>;
  const owner = typeof record.ownerUsername === "string" ? record.ownerUsername : undefined;
  const slug = typeof record.normalizedSlug === "string" ? record.normalizedSlug : typeof record.slug === "string" ? record.slug : undefined;
  if (!owner || !slug) return undefined;
  return [{ command: `aa path project ${owner} ${slug}`, description: "List artifacts in project" }];
}
