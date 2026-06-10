import {
  createArtifactInputSchema,
  createProjectInputSchema,
  restoreArtifactVersionInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema,
  type ArtifactService,
  type ProjectService
} from "@agent-artifacts/artifact";
import type { Principal } from "@agent-artifacts/shared";
import { z, type ZodTypeAny } from "zod";

const versionNumberSchema = z.number().int().positive();

export interface McpHandlerContext {
  artifactService: ArtifactService;
  projectService: ProjectService;
  principal: Principal;
}

interface ToolDef<S extends ZodTypeAny, R> {
  description: string;
  schema: S;
  handler: (input: z.infer<S>, ctx: McpHandlerContext) => Promise<R>;
}

const def = <S extends ZodTypeAny, R>(tool: ToolDef<S, R>) => tool;

export const mcpTools = {
  get_current_principal: def({
    description: "Return the authenticated principal for the current MCP request.",
    schema: z.object({}),
    handler: async (_input, ctx) => ctx.principal
  }),
  check_project_slug_availability: def({
    description: "Check whether a project slug is available in an owner namespace.",
    schema: z.object({
      ownerUsername: z.string().min(1),
      slug: z.string().min(1)
    }),
    handler: (input, ctx) =>
      ctx.projectService.checkProjectSlugAvailability(input.ownerUsername, input.slug, ctx.principal)
  }),
  create_project: def({
    description: "Create a new project to group artifacts.",
    schema: createProjectInputSchema,
    handler: (input, ctx) => ctx.projectService.createProject(input, ctx.principal)
  }),
  list_projects: def({
    description: "List projects owned by the authenticated human user.",
    schema: z.object({}),
    handler: async (_input, ctx) => ctx.projectService.listOwnedProjects(ctx.principal)
  }),
  check_slug_availability: def({
    description: "Check whether an artifact slug is available within a project.",
    schema: z.object({
      ownerUsername: z.string().min(1),
      projectSlug: z.string().min(1),
      slug: z.string().min(1)
    }),
    handler: (input, ctx) =>
      ctx.artifactService.checkSlugAvailability(
        input.ownerUsername,
        input.projectSlug,
        input.slug,
        ctx.principal
      )
  }),
  create_artifact: def({
    description: "Create a new artifact and immutable first version.",
    schema: createArtifactInputSchema,
    handler: (input, ctx) => ctx.artifactService.createArtifact(input, ctx.principal)
  }),
  update_artifact: def({
    description: "Append a new immutable version to an artifact.",
    schema: updateArtifactInputSchema,
    handler: (input, ctx) => ctx.artifactService.updateArtifact(input, ctx.principal)
  }),
  restore_artifact_version: def({
    description: "Restore an old artifact version by creating a new head version from it.",
    schema: restoreArtifactVersionInputSchema,
    handler: (input, ctx) => ctx.artifactService.restoreArtifactVersion(input, ctx.principal)
  }),
  get_artifact: def({
    description: "Read artifact metadata for an authorized principal.",
    schema: z.object({
      artifactId: z.string().min(1)
    }),
    handler: (input, ctx) => ctx.artifactService.getArtifact(input.artifactId, ctx.principal)
  }),
  get_artifact_content: def({
    description: "Read source content for an artifact version.",
    schema: z.object({
      artifactId: z.string().min(1),
      versionNumber: versionNumberSchema.optional()
    }),
    handler: (input, ctx) =>
      ctx.artifactService.getArtifactContent(input.artifactId, ctx.principal, input.versionNumber)
  }),
  list_artifacts: def({
    description: "List artifacts owned by the authenticated human user.",
    schema: z.object({}),
    handler: async (_input, ctx) => ctx.artifactService.listOwnedArtifacts(ctx.principal)
  }),
  list_artifact_versions: def({
    description: "List immutable versions for an artifact.",
    schema: z.object({
      artifactId: z.string().min(1),
      limit: z.number().int().positive().max(100).optional()
    }),
    handler: (input, ctx) =>
      ctx.artifactService.listArtifactVersions(input.artifactId, ctx.principal, input.limit)
  }),
  diff_artifact_versions: def({
    description: "Return a unified diff between two artifact versions.",
    schema: z.object({
      artifactId: z.string().min(1),
      fromVersion: versionNumberSchema,
      toVersion: versionNumberSchema
    }),
    handler: (input, ctx) =>
      ctx.artifactService.diffArtifactVersions(
        input.artifactId,
        ctx.principal,
        input.fromVersion,
        input.toVersion
      )
  }),
  get_artifact_access: def({
    description: "Read artifact access settings.",
    schema: z.object({
      artifactId: z.string().min(1)
    }),
    handler: (input, ctx) => ctx.artifactService.getArtifactAccess(input.artifactId, ctx.principal)
  }),
  set_artifact_access: def({
    description: "Update artifact access settings.",
    schema: z.object({
      artifactId: z.string().min(1),
      access: setArtifactAccessInputSchema
    }),
    handler: (input, ctx) =>
      ctx.artifactService.setArtifactAccess(input.artifactId, input.access, ctx.principal)
  }),
  delete_artifact: def({
    description: "Soft-delete an artifact. Owner-only. Hides it from all reads but preserves audit history.",
    schema: z.object({
      artifactId: z.string().min(1)
    }),
    handler: (input, ctx) => ctx.artifactService.deleteArtifact(input.artifactId, ctx.principal)
  })
} as const;

export type McpToolName = keyof typeof mcpTools;

export const mcpToolInputSchemas = Object.fromEntries(
  Object.entries(mcpTools).map(([name, tool]) => [name, tool.schema])
) as { [K in McpToolName]: (typeof mcpTools)[K]["schema"] };

export type McpToolInput<TToolName extends McpToolName> = z.infer<(typeof mcpToolInputSchemas)[TToolName]>;

export const mcpToolDescriptions = Object.fromEntries(
  Object.entries(mcpTools).map(([name, tool]) => [name, tool.description])
) as Record<McpToolName, string>;

export function listMcpTools() {
  return (Object.keys(mcpTools) as McpToolName[]).map((name) => ({
    name,
    description: mcpTools[name].description,
    inputSchema: z.toJSONSchema(mcpTools[name].schema)
  }));
}

async function invokeTool<S extends ZodTypeAny>(
  tool: ToolDef<S, unknown>,
  input: unknown,
  context: McpHandlerContext
): Promise<unknown> {
  const parsed = tool.schema.parse(input);
  return tool.handler(parsed, context);
}

export async function callMcpTool<TToolName extends McpToolName>(
  toolName: TToolName,
  input: unknown,
  context: McpHandlerContext
): Promise<unknown> {
  return invokeTool(mcpTools[toolName], input, context);
}
