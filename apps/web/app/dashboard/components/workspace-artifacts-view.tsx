"use client";

import type { WorkspaceSummary } from "../../../lib/server-api";
import { ArtifactBrowser } from "./artifact-browser";
import { useDashboardWorkspace } from "./dashboard-workspace-data";

function workspaceLabel(workspace: WorkspaceSummary): string {
  return workspace.kind === "personal" ? "Personal" : workspace.name;
}

export function WorkspaceArtifactsView() {
  const { workspace, artifacts } = useDashboardWorkspace();

  return (
    <ArtifactBrowser
      kicker={workspace.kind === "personal" ? "Personal workspace" : "Team workspace"}
      title={workspaceLabel(workspace)}
      pathLabel={`/${workspace.slug}`}
      artifacts={artifacts}
      scope="workspace"
      emptyTitle="Nothing published yet"
      emptyHint={`Artifacts published into /${workspace.slug} from the CLI, MCP, or REST API show up here with a live preview.`}
    />
  );
}
