import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/program.js";

describe("setup command", () => {
  const output: string[] = [];

  afterEach(() => {
    output.length = 0;
    vi.restoreAllMocks();
  });

  it("prints ready-to-paste MCP config when credentials are present", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      output.push(String(chunk));
      return true;
    });

    await runCli([
      "node",
      "artifacts",
      "--token",
      "test-token",
      "--web-url",
      "https://artifacts.example.com",
      "--base-url",
      "https://api.artifacts.example.com",
      "--format",
      "json",
      "setup"
    ]);

    const payload = JSON.parse(output.join("")) as {
      data: {
        status: string;
        mcp: { serverUrl: string; clientConfig: { mcpServers: { "agent-artifacts": { url: string } } } };
      };
    };

    expect(payload.data.status).toBe("ready");
    expect(payload.data.mcp.serverUrl).toBe("https://artifacts.example.com/mcp");
    expect(payload.data.mcp.clientConfig.mcpServers["agent-artifacts"].url).toBe(
      "https://artifacts.example.com/mcp"
    );
  });
});
