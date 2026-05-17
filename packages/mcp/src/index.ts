import {
  createArtifactInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema,
  type ArtifactService
} from "@agent-artifacts/artifact";
import type { Principal } from "@agent-artifacts/shared";
import { z } from "zod";

const versionNumberSchema = z.number().int().positive();

export const mcpToolInputSchemas = {
  check_slug_availability: z.object({
    ownerUsername: z.string().min(1),
    slug: z.string().min(1)
  }),
  create_artifact: createArtifactInputSchema,
  update_artifact: updateArtifactInputSchema,
  get_artifact: z.object({
    artifactId: z.string().min(1)
  }),
  get_artifact_content: z.object({
    artifactId: z.string().min(1),
    versionNumber: versionNumberSchema.optional()
  }),
  list_artifacts: z.object({}),
  list_artifact_versions: z.object({
    artifactId: z.string().min(1),
    limit: z.number().int().positive().max(100).optional()
  }),
  diff_artifact_versions: z.object({
    artifactId: z.string().min(1),
    fromVersion: versionNumberSchema,
    toVersion: versionNumberSchema
  }),
  get_artifact_access: z.object({
    artifactId: z.string().min(1)
  }),
  set_artifact_access: z.object({
    artifactId: z.string().min(1),
    access: setArtifactAccessInputSchema
  })
} as const;

export type McpToolName = keyof typeof mcpToolInputSchemas;
export type McpToolInput<TToolName extends McpToolName> = z.infer<(typeof mcpToolInputSchemas)[TToolName]>;

export const mcpToolDescriptions: Record<McpToolName, string> = {
  check_slug_availability: "Check whether a slug is available in an owner namespace.",
  create_artifact: "Create a new artifact and immutable first version.",
  update_artifact: "Append a new immutable version to an artifact.",
  get_artifact: "Read artifact metadata for an authorized principal.",
  get_artifact_content: "Read source content for an artifact version.",
  list_artifacts: "List artifacts owned by the authenticated human user.",
  list_artifact_versions: "List immutable versions for an artifact.",
  diff_artifact_versions: "Return a unified diff between two artifact versions.",
  get_artifact_access: "Read artifact access settings.",
  set_artifact_access: "Update artifact access settings."
};

export function listMcpTools() {
  return (Object.keys(mcpToolInputSchemas) as McpToolName[]).map((name) => ({
    name,
    description: mcpToolDescriptions[name],
    inputSchema: z.toJSONSchema(mcpToolInputSchemas[name])
  }));
}

export interface McpHandlerContext {
  artifactService: ArtifactService;
  principal: Principal;
}

export async function callMcpTool<TToolName extends McpToolName>(
  toolName: TToolName,
  input: unknown,
  context: McpHandlerContext
): Promise<unknown> {
  const parsed = mcpToolInputSchemas[toolName].parse(input);

  switch (toolName) {
    case "check_slug_availability": {
      const request = parsed as McpToolInput<"check_slug_availability">;
      return context.artifactService.checkSlugAvailability(request.ownerUsername, request.slug, context.principal);
    }
    case "create_artifact":
      return context.artifactService.createArtifact(parsed as McpToolInput<"create_artifact">, context.principal);
    case "update_artifact":
      return context.artifactService.updateArtifact(parsed as McpToolInput<"update_artifact">, context.principal);
    case "get_artifact": {
      const request = parsed as McpToolInput<"get_artifact">;
      return context.artifactService.getArtifact(request.artifactId, context.principal);
    }
    case "get_artifact_content": {
      const request = parsed as McpToolInput<"get_artifact_content">;
      return context.artifactService.getArtifactContent(request.artifactId, context.principal, request.versionNumber);
    }
    case "list_artifacts":
      return context.artifactService.listOwnedArtifacts(context.principal);
    case "list_artifact_versions": {
      const request = parsed as McpToolInput<"list_artifact_versions">;
      return context.artifactService.listArtifactVersions(request.artifactId, context.principal, request.limit);
    }
    case "diff_artifact_versions": {
      const request = parsed as McpToolInput<"diff_artifact_versions">;
      return context.artifactService.diffArtifactVersions(
        request.artifactId,
        context.principal,
        request.fromVersion,
        request.toVersion
      );
    }
    case "get_artifact_access": {
      const request = parsed as McpToolInput<"get_artifact_access">;
      return context.artifactService.getArtifactAccess(request.artifactId, context.principal);
    }
    case "set_artifact_access": {
      const request = parsed as McpToolInput<"set_artifact_access">;
      return context.artifactService.setArtifactAccess(request.artifactId, request.access, context.principal);
    }
    default:
      return assertNever(toolName);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled MCP tool: ${String(value)}`);
}
