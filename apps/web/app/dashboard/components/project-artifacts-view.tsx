"use client";

import { projectPath } from "../../../lib/paths";
import { ArtifactBrowser } from "./artifact-browser";
import { useDashboardWorkspace } from "./dashboard-workspace-data";

export function ProjectArtifactsView({ projectSlug }: { projectSlug: string }) {
  const { projects, artifacts } = useDashboardWorkspace();
  const project = projects.find((candidate) => candidate.slug.toLowerCase() === projectSlug.toLowerCase());

  if (!project) {
    return (
      <ArtifactBrowser
        title="Project not found"
        artifacts={[]}
        scope="project"
        emptyTitle="Project not found"
        emptyHint="Choose a project from the sidebar to open a known namespace."
      />
    );
  }

  const projectArtifacts = artifacts.filter((artifact) => artifact.projectId === project.id);

  return (
    <ArtifactBrowser
      title={project.title}
      description={project.description}
      artifacts={projectArtifacts}
      scope="project"
      emptyTitle="No artifacts in this project"
      emptyHint={`Publish into ${projectPath(project)} to collect versioned artifacts under this namespace.`}
      createHref={`/dashboard/${project.workspaceSlug}/artifacts/new?project=${encodeURIComponent(project.slug)}`}
    />
  );
}
