import { describe, expect, it } from "vitest";
import { buildDryRunPreview } from "../src/dry-run.js";
import {
  artifactCreateCommand,
  artifactDeleteCommand,
  artifactUpdateCommand,
  artifactAccessSetCommand
} from "../src/commands/artifact.js";
import { loginCommand } from "../src/commands/login.js";
import { logoutCommand } from "../src/commands/logout.js";
import { profileSetUsernameCommand } from "../src/commands/profile-set-username.js";
import { projectCreateCommand } from "../src/commands/project.js";
import { shareCreateCommand, shareRevokeCommand } from "../src/commands/share.js";

describe("buildDryRunPreview", () => {
  it("interpolates artifact delete path", () => {
    const preview = buildDryRunPreview(artifactDeleteCommand, undefined, { artifactId: "art_123" });
    expect(preview.http).toEqual({ method: "DELETE", path: "/api/artifacts/art_123" });
  });

  it("interpolates artifact update path", () => {
    const preview = buildDryRunPreview(
      artifactUpdateCommand,
      { content: "# v2" },
      { artifactId: "art_123" }
    );
    expect(preview.http).toEqual({ method: "POST", path: "/api/artifacts/art_123/versions" });
  });

  it("interpolates artifact access set path", () => {
    const preview = buildDryRunPreview(
      artifactAccessSetCommand,
      { publicView: true },
      { artifactId: "art_123" }
    );
    expect(preview.http).toEqual({ method: "PATCH", path: "/api/artifacts/art_123/access" });
  });

  it("interpolates share create path", () => {
    const preview = buildDryRunPreview(
      shareCreateCommand,
      { role: "viewer" },
      { artifactId: "art_123" }
    );
    expect(preview.http).toEqual({ method: "POST", path: "/api/artifacts/art_123/share-links" });
  });

  it("interpolates share revoke path", () => {
    const preview = buildDryRunPreview(shareRevokeCommand, {}, { shareLinkId: "share_123" });
    expect(preview.http).toEqual({ method: "POST", path: "/api/share-links/share_123/revoke" });
  });

  it("leaves static paths unchanged for create commands", () => {
    expect(buildDryRunPreview(artifactCreateCommand, { slug: "readme" }, {}).http).toEqual({
      method: "POST",
      path: "/api/artifacts"
    });
    expect(buildDryRunPreview(projectCreateCommand, { slug: "my-app" }, {}).http).toEqual({
      method: "POST",
      path: "/api/projects"
    });
  });

  it("covers login, logout, and profile set-username", () => {
    expect(buildDryRunPreview(loginCommand, undefined, {}).mutates).toBe(true);
    expect(buildDryRunPreview(logoutCommand, undefined, {}).mutates).toBe(true);
    expect(buildDryRunPreview(profileSetUsernameCommand, { username: "alice" }, {}).http).toEqual({
      method: "POST",
      path: "/api/profile/username"
    });
  });

  it("does not leave path placeholders", () => {
    const preview = buildDryRunPreview(artifactDeleteCommand, undefined, { artifactId: "art_123" });
    expect(String((preview.http as { path: string }).path)).not.toMatch(/\{/);
  });
});
