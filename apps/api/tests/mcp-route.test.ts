import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("MCP endpoint", () => {
  it("responds to initialize", async () => {
    const response = await app.request("/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize"
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "agent-artifacts"
        }
      }
    });
  });

  it("lists MCP tools without touching protected domain services", async () => {
    const response = await app.request("/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "tools",
        method: "tools/list"
      })
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    const toolNames = payload.result.tools.map((tool: { name: string }) => tool.name);

    expect(toolNames).toContain("get_current_principal");
    expect(toolNames).toContain("create_artifact");
    expect(toolNames).toContain("set_artifact_access");
  });
});
