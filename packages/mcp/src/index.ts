import {
  createArtifactInputSchema,
  createProjectInputSchema,
  restoreArtifactVersionInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema,
  type AuditService,
  type ArtifactService,
  type ProjectService,
  type ShareLinkService
} from "@agent-artifacts/artifact";
import { ArtifactForbiddenError, shareLinkRoleSchema, type Principal } from "@agent-artifacts/shared";
import { z, type ZodTypeAny } from "zod";

const versionNumberSchema = z.number().int().positive();

type McpBillingService = {
  getAccountEntitlements(ownerUserId: string): Promise<{ plan: { entitlements: { shareLinks: boolean } } }>;
};

type McpWorkspaceService = {
  listWorkspacesForUser(principal: Principal): Promise<unknown[]>;
};

export interface McpHandlerContext {
  artifactService: ArtifactService;
  projectService: ProjectService;
  auditService?: AuditService;
  billingService?: McpBillingService;
  shareLinkService?: ShareLinkService;
  workspaceService?: McpWorkspaceService;
  principal: Principal;
}

interface ToolDef<S extends ZodTypeAny, R> {
  description: string;
  schema: S;
  handler: (input: z.infer<S>, ctx: McpHandlerContext) => Promise<R>;
}

const def = <S extends ZodTypeAny, R>(tool: ToolDef<S, R>) => tool;

function requireContext<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`${name} is not configured for MCP tools.`);
  }
  return value;
}

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
  create_share_link: def({
    description: "Create a viewer or editor share link for an artifact.",
    schema: z.object({
      artifactId: z.string().min(1),
      role: shareLinkRoleSchema.default("viewer"),
      expiresAt: z.iso.datetime().optional()
    }),
    handler: async (input, ctx) => {
      const artifact = await ctx.artifactService.getArtifact(input.artifactId, ctx.principal);
      const canCreate = await ctx.artifactService.checkArtifactPermission(
        input.artifactId,
        "artifact.create_share_link",
        ctx.principal
      );
      if (!canCreate) {
        throw new ArtifactForbiddenError("Admin permission required.");
      }

      const billingService = requireContext(ctx.billingService, "billingService");
      const entitlements = await billingService.getAccountEntitlements(artifact.ownerUserId);
      if (!entitlements.plan.entitlements.shareLinks) {
        throw new Error("Share links require Pro.");
      }

      return requireContext(ctx.shareLinkService, "shareLinkService").createShareLink({
        artifactId: input.artifactId,
        role: input.role,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        createdByPrincipalType: ctx.principal.type,
        createdByPrincipalId: ctx.principal.id
      });
    }
  }),
  list_share_links: def({
    description: "List share links for an artifact.",
    schema: z.object({
      artifactId: z.string().min(1)
    }),
    handler: async (input, ctx) => {
      const canList = await ctx.artifactService.checkArtifactPermission(
        input.artifactId,
        "artifact.create_share_link",
        ctx.principal
      );
      if (!canList) {
        throw new ArtifactForbiddenError("Admin permission required.");
      }

      return { shareLinks: await requireContext(ctx.shareLinkService, "shareLinkService").listShareLinks(input.artifactId) };
    }
  }),
  revoke_share_link: def({
    description: "Revoke a share link.",
    schema: z.object({
      shareLinkId: z.string().min(1)
    }),
    handler: async (input, ctx) => {
      const shareLinkService = requireContext(ctx.shareLinkService, "shareLinkService");
      const link = await shareLinkService.getShareLinkById(input.shareLinkId);
      if (!link) {
        throw new ArtifactForbiddenError("Share link not found.");
      }
      const canRevoke = await ctx.artifactService.checkArtifactPermission(
        link.artifactId,
        "artifact.revoke_share_link",
        ctx.principal
      );
      if (!canRevoke) {
        throw new ArtifactForbiddenError("Admin permission required.");
      }

      await shareLinkService.revokeShareLink(input.shareLinkId);
      return { revoked: true };
    }
  }),
  list_audit_events: def({
    description: "List owner or artifact audit events.",
    schema: z.object({
      artifactId: z.string().min(1).optional(),
      limit: z.number().int().positive().max(100).optional()
    }),
    handler: async (input, ctx) => {
      const auditService = requireContext(ctx.auditService, "auditService");
      if (input.artifactId) {
        const artifact = await ctx.artifactService.getArtifact(input.artifactId, ctx.principal);
        const canViewAudit = await ctx.artifactService.checkArtifactPermission(
          input.artifactId,
          "artifact.manage_access",
          ctx.principal
        );
        if (!canViewAudit) {
          throw new ArtifactForbiddenError("Admin permission required.");
        }
        return {
          events: await auditService.listAuditEvents({
            artifactId: input.artifactId,
            retentionOwnerUserId: artifact.ownerUserId,
            limit: input.limit
          })
        };
      }
      if (ctx.principal.type !== "user") {
        throw new ArtifactForbiddenError("Only signed-in users can list account audit events.");
      }
      return {
        events: await auditService.listAuditEvents({
          ownerUserId: ctx.principal.id,
          retentionOwnerUserId: ctx.principal.id,
          limit: input.limit
        })
      };
    }
  }),
  resolve_path: def({
    description: "Resolve a project or artifact by owner/project/slug path.",
    schema: z.object({
      ownerUsername: z.string().min(1),
      projectSlug: z.string().min(1),
      slug: z.string().min(1).optional()
    }),
    handler: async (input, ctx) => {
      if (input.slug) {
        return { artifact: await ctx.artifactService.getArtifactByPath(input.ownerUsername, input.projectSlug, input.slug, ctx.principal) };
      }
      return { project: await ctx.projectService.getProjectByPath(input.ownerUsername, input.projectSlug, ctx.principal) };
    }
  }),
  list_workspaces: def({
    description: "List workspaces for the authenticated user.",
    schema: z.object({}),
    handler: async (_input, ctx) => ({
      workspaces: await requireContext(ctx.workspaceService, "workspaceService").listWorkspacesForUser(ctx.principal)
    })
  }),
  list_workspace_artifacts: def({
    description: "List artifacts visible to the principal in a workspace.",
    schema: z.object({
      workspaceId: z.string().min(1)
    }),
    handler: async (input, ctx) => ({
      artifacts: await ctx.artifactService.listWorkspaceArtifacts(input.workspaceId, ctx.principal)
    })
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
