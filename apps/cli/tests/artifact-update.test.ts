import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/client.js";
import { runCli } from "../src/program.js";

describe("artifact update command", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merges --artifact-id into the JSON body before schema validation", async () => {
    const post = vi.spyOn(ApiClient.prototype, "post").mockResolvedValue({
      artifactId: "artifact_123",
      versionNumber: 2
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli([
      "node",
      "artifacts",
      "--token",
      "test-token",
      "artifact",
      "update",
      "--artifact-id",
      "artifact_123",
      "--json",
      '{"content":"# Updated"}'
    ]);

    expect(post).toHaveBeenCalledWith("/api/artifacts/artifact_123/versions", {
      artifactId: "artifact_123",
      content: "# Updated"
    });
  });
});
