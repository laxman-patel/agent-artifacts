import { describe, expect, it } from "vitest";
import { ArtifactForbiddenError, type ArtifactService } from "@agent-artifacts/artifact";
import type { Principal } from "@agent-artifacts/shared";
import { callMcpTool, listMcpTools } from "../src/index.js";

const apiKeyPrincipal: Principal = {
  type: "api_key",
  id: "key_1",
  ownerUserId: "user_1",
  scopes: ["artifacts:read", "artifacts:create"]
};

describe("MCP tool handlers", () => {
  it("exposes MCP tool metadata with JSON schemas", () => {
    const tools = listMcpTools();

    expect(tools.map((tool) => tool.name)).toContain("create_artifact");
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
        slug: "demo",
        type: "markdown",
        title: "Demo",
        content: "# Demo"
      },
      {
        artifactService: service,
        principal: apiKeyPrincipal
      }
    );

    expect(result).toMatchObject({
      principalType: "api_key",
      principalScopes: ["artifacts:read", "artifacts:create"]
    });
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
          principal: apiKeyPrincipal
        }
      )
    ).rejects.toThrow("Requires artifacts:update scope");
  });
});
