import { ProjectArtifactsView } from "../../../components/project-artifacts-view";

export default async function ProjectDashboardPage(props: {
  params: Promise<{ workspaceSlug: string; projectSlug: string }>;
}) {
  const { projectSlug } = await props.params;
  return <ProjectArtifactsView projectSlug={projectSlug} />;
}
