import { describe, expect, it } from "vitest";
import { buildAgentSchema, listCliCommandSpecs } from "../src/schema-registry.js";

describe("CLI schema", () => {
  it("documents every REST API command", () => {
    const commands = listCliCommandSpecs().map((c) => c.command).sort();
    expect(commands).toEqual([
      "artifact access get",
      "artifact access set",
      "artifact content",
      "artifact create",
      "artifact delete",
      "artifact diff",
      "artifact get",
      "artifact list",
      "artifact slug-availability",
      "artifact update",
      "artifact url-preview",
      "artifact versions",
      "audit list",
      "health",
      "path artifact",
      "path project",
      "profile get",
      "profile set-username",
      "project create",
      "project list",
      "project slug-availability",
      "share create",
      "share list",
      "share revoke"
    ]);
  });

  it("exposes machine-readable agent schema", () => {
    const schema = buildAgentSchema();
    expect(schema.name).toBe("artifacts");
    expect(schema.commands.length).toBeGreaterThanOrEqual(20);
    expect(schema.discovery).toContain("artifacts schema");
    expect(schema.output.envelope.success.ok).toBe(true);
  });

  it("maps commands to HTTP endpoints", () => {
    const create = listCliCommandSpecs().find((c) => c.command === "artifact create");
    expect(create?.http).toEqual({ method: "POST", path: "/api/artifacts" });
    expect(create?.bodySchema).toBeDefined();
  });
});
