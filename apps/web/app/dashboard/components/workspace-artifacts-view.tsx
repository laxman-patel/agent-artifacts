"use client";

import type { WorkspaceSummary } from "../../../lib/server-api";
import { ArtifactBrowser } from "./artifact-browser";
import { useDashboardWorkspace } from "./dashboard-workspace-data";

function teamLabel(workspace: WorkspaceSummary): string {
  return workspace.kind === "personal" ? "Personal library" : workspace.name;
}

export function WorkspaceArtifactsView() {
  const { workspace, artifacts } = useDashboardWorkspace();

  return (
    <ArtifactBrowser
      title={teamLabel(workspace)}
      artifacts={artifacts}
      scope="workspace"
      emptyTitle="Nothing published yet"
      emptyHint="Artifacts published from the CLI, MCP, or REST API show up here with a live preview."
      createHref={`/dashboard/${workspace.slug}/artifacts/new`}
    />
  );
}
