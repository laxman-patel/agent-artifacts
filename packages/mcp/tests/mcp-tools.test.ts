import { describe, expect, it } from "vitest";
import { ArtifactForbiddenError, type ArtifactService } from "@agent-artifacts/artifact";
import type { Principal } from "@agent-artifacts/shared";
import type { WorkspaceService } from "@agent-artifacts/workspace";
import { callMcpTool, listMcpTools } from "../src/index.js";

const apiKeyPrincipal: Principal = {
  type: "api_key",
  id: "key_1",
  ownerUserId: "user_1",
  scopes: ["artifacts:read", "artifacts:create"]
};

const emptyWorkspaceService = {} as WorkspaceService;

describe("MCP tool handlers", () => {
  it("exposes MCP tool metadata with JSON schemas", () => {
    const tools = listMcpTools();

    expect(tools.map((tool) => tool.name)).toContain("create_artifact");
    expect(tools.map((tool) => tool.name)).toContain("list_workspaces");
    expect(tools.find((tool) => tool.name === "create_artifact")?.inputSchema).toMatchObject({
      type: "object"
    });
  });

  it("delegates create_artifact to the artifact service with the authenticated principal", async () => {
    const service = {
      async createArtifact(input: unknown, principal: Principal) {
        return {
          input,
          principalType: principal.type,
          principalScopes: principal.scopes
        };
      }
    } as unknown as ArtifactService;

    const result = await callMcpTool(
      "create_artifact",
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "demo",
        type: "md",
        title: "Demo",
        content: "# Demo"
      },
      {
        artifactService: service,
        projectService: {} as never,
        workspaceService: emptyWorkspaceService,
        principal: apiKeyPrincipal
      }
    );

    expect(result).toMatchObject({
      principalType: "api_key",
      principalScopes: ["artifacts:read", "artifacts:create"]
    });
  });

  it("uses workspaceSlug as ownerUsername when creating artifacts in a workspace", async () => {
    const service = {
      async createArtifact(input: { ownerUsername: string }, principal: Principal) {
        return { ownerUsername: input.ownerUsername, principalType: principal.type };
      }
    } as unknown as ArtifactService;

    const result = await callMcpTool(
      "create_artifact",
      {
        workspaceSlug: "acme",
        projectSlug: "default",
        slug: "demo",
        type: "md",
        title: "Demo",
        content: "# Demo"
      },
      {
        artifactService: service,
        projectService: {} as never,
        workspaceService: emptyWorkspaceService,
        principal: apiKeyPrincipal
      }
    );

    expect(result).toMatchObject({ ownerUsername: "acme" });
  });

  it("delegates list_workspaces to the workspace service", async () => {
    const workspaceService = {
      async listWorkspacesForUser(principal: Principal) {
        return [{ slug: "acme", role: "owner", principalType: principal.type }];
      }
    } as unknown as WorkspaceService;

    const result = await callMcpTool(
      "list_workspaces",
      {},
      {
        artifactService: {} as never,
        projectService: {} as never,
        workspaceService,
        principal: { type: "user", id: "user_1", email: "user@example.com" }
      }
    );

    expect(result).toEqual([{ slug: "acme", role: "owner", principalType: "user" }]);
  });

  it("preserves authorization failures from domain services", async () => {
    const service = {
      async updateArtifact() {
        throw new ArtifactForbiddenError("Requires artifacts:update scope for artifact.update.");
      }
    } as unknown as ArtifactService;

    await expect(
      callMcpTool(
        "update_artifact",
        {
          artifactId: "artifact_1",
          content: "new content"
        },
        {
          artifactService: service,
          projectService: {} as never,
          workspaceService: emptyWorkspaceService,
          principal: apiKeyPrincipal
        }
      )
    ).rejects.toThrow("Requires artifacts:update scope");
  });
});
