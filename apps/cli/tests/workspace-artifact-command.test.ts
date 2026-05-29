import { describe, expect, it } from "vitest";
import { artifactCreateCommand } from "../src/commands/artifact.js";
import type { ApiClient } from "../src/client.js";
import type { CliConfig } from "../src/config.js";

function createConfig(workspace?: string): CliConfig {
  return {
    baseUrl: "https://api.example.com",
    webUrl: "https://app.example.com",
    workspace,
    format: "json",
    quiet: false,
    noInput: false,
    debug: false,
    dryRun: false,
    ndjson: false
  };
}

describe("workspace artifact commands", () => {
  it("creates artifacts through the workspace artifact endpoint", async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    const client = {
      async get(path: string) {
        calls.push({ method: "GET", path });
        return { workspaces: [{ id: "ws_acme", slug: "acme" }] };
      },
      async post(path: string, body: unknown) {
        calls.push({ method: "POST", path, body });
        return { artifact: { artifactId: "artifact_1" } };
      }
    } as unknown as ApiClient;

    const result = await artifactCreateCommand.run({
      client,
      config: createConfig("acme"),
      options: {},
      body: {
        ownerUsername: "ignored-personal-owner",
        projectSlug: "default",
        slug: "demo",
        type: "md",
        title: "Demo",
        content: "# Demo"
      }
    });

    expect(result.data).toMatchObject({ artifactId: "artifact_1", created: true });
    expect(calls).toEqual([
      { method: "GET", path: "/api/workspaces" },
      {
        method: "POST",
        path: "/api/workspaces/ws_acme/artifacts",
        body: {
          projectSlug: "default",
          slug: "demo",
          type: "md",
          title: "Demo",
          content: "# Demo",
          access: {
            publicView: true,
            publicEdit: false
          }
        }
      }
    ]);
  });
});
