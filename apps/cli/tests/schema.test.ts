import { describe, expect, it } from "vitest";
import { buildAgentSchema, listCliCommandSpecs } from "../src/schema-registry.js";
import { listMcpTools } from "@agent-artifacts/mcp";

describe("CLI schema", () => {
  it("covers every MCP tool", () => {
    const mcpNames = listMcpTools().map((t) => t.name).sort();
    const cliMcp = listCliCommandSpecs()
      .flatMap((c) => (c.mcpTool ? [c.mcpTool] : []))
      .sort();

    expect(cliMcp).toEqual(mcpNames);
  });

  it("exposes machine-readable agent schema", () => {
    const schema = buildAgentSchema();
    expect(schema.name).toBe("agent-artifacts");
    expect(schema.commands.length).toBeGreaterThanOrEqual(15);
    expect(schema.invoke).toMatchObject({ example: expect.stringContaining("aa invoke") });
  });
});
