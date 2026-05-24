import { describe, expect, it } from "vitest";
import { buildDryRunPreview } from "../src/dry-run.js";
import { artifactDeleteCommand } from "../src/commands/artifact.js";

describe("buildDryRunPreview", () => {
  it("describes the HTTP call from required flags", () => {
    const preview = buildDryRunPreview(artifactDeleteCommand, undefined, { artifactId: "art_123" });
    expect(preview).toMatchObject({
      dry_run: true,
      command: "artifact delete",
      mutates: true,
      http: {
        method: "DELETE",
        path: "/api/artifacts/art_123"
      },
      example: "artifacts artifact delete --artifact-id ARTIFACT_ID"
    });
  });
});
