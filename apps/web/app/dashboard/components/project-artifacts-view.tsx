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
        kicker="Project"
        title="Project not found"
        pathLabel={`/${projectSlug}`}
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
      kicker="Project"
      title={project.title}
      pathLabel={projectPath(project)}
      description={project.description}
      artifacts={projectArtifacts}
      scope="project"
      emptyTitle="No artifacts in this project"
      emptyHint={`Publish into ${projectPath(project)} to collect versioned artifacts under this namespace.`}
    />
  );
}
