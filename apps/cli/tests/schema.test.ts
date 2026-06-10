import { describe, expect, it } from "vitest";
import { buildAgentSchema, listCliCommandSpecs } from "../src/schema-registry.js";
import { readCliVersion } from "../src/version.js";

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
      "artifact restore",
      "artifact slug-availability",
      "artifact update",
      "artifact url-preview",
      "artifact versions",
      "audit list",
      "health",
      "login",
      "logout",
      "path artifact",
      "path project",
      "profile get",
      "profile set-username",
      "project create",
      "project list",
      "project slug-availability",
      "setup",
      "share create",
      "share list",
      "share revoke",
      "whoami"
    ]);
  });

  it("exposes machine-readable agent schema", () => {
    const schema = buildAgentSchema();
    expect(schema.name).toBe("artifacts");
    expect(schema.version).toBe(readCliVersion());
    expect(schema.commands.length).toBeGreaterThanOrEqual(20);
    expect(schema.discovery).toContain("artifacts schema");
    expect(schema.globalFlags.noInput.flag).toBe("--no-input");
    expect(schema.globalFlags.dryRun.flag).toContain("--dry-run");
    expect(schema.input.jsonBody.stdin).toContain("--json-file -");
    expect(schema.input.resourceIds.artifactId.flag).toBe("--artifact-id");
    expect(schema.input.positionalArgs).toBe(false);
    expect(schema.webUrl.flag).toBe("--web-url");
    expect(schema.list.defaultLimit).toBe(50);
    expect(schema.output.envelope.success.ok).toBe(true);
  });

  it("maps commands to HTTP endpoints", () => {
    const create = listCliCommandSpecs().find((c) => c.command === "artifact create");
    expect(create?.http).toEqual({ method: "POST", path: "/api/artifacts" });
    expect(create?.bodySchema).toBeDefined();
    expect(create?.flags?.some((f) => f.flag.startsWith("--json"))).toBe(true);
  });

  it("documents required flags on resource commands", () => {
    const get = listCliCommandSpecs().find((c) => c.command === "artifact get");
    expect(get?.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flag: "--artifact-id <id>", required: true })
      ])
    );
  });
});
