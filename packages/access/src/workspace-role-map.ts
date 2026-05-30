import type { ArtifactRole, WorkspaceRole } from "@agent-artifacts/shared";

/** Map workspace membership to inherited artifact roles for team content. */
export function workspaceRoleToArtifactRole(role: WorkspaceRole): ArtifactRole | undefined {
  switch (role) {
    case "owner":
      return "owner";
    case "admin":
      return "admin";
    case "member":
      return "editor";
    case "viewer":
      return "viewer";
    case "billing_admin":
      return undefined;
  }
}
