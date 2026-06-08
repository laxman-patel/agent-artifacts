import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  cookieHeader,
  fetchWorkspaceArtifacts,
  fetchWorkspaces,
  type WorkspaceSummary
} from "../../../lib/server-api";
import { ArtifactBrowser } from "../components/artifact-browser";

function workspaceLabel(workspace: WorkspaceSummary): string {
  return workspace.kind === "personal" ? "Personal" : workspace.name;
}

export default async function WorkspaceDashboardPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const workspacesResult = await fetchWorkspaces(header);

  if (!workspacesResult.ok && (workspacesResult.status === 401 || workspacesResult.status === 403)) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/${workspaceSlug}`)}`);
  }

  if (!workspacesResult.ok) {
    throw new Error(workspacesResult.message ?? "Workspaces could not be loaded.");
  }

  const workspace = workspacesResult.body.workspaces.find(
    (candidate) => candidate.slug.toLowerCase() === workspaceSlug.toLowerCase()
  );

  if (!workspace) {
    notFound();
  }

  const artifactsResult = await fetchWorkspaceArtifacts(workspace.id, header);
  if (!artifactsResult.ok) {
    throw new Error(artifactsResult.message ?? `Artifacts could not be loaded (HTTP ${artifactsResult.status}).`);
  }
  const artifacts = artifactsResult.body.artifacts.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

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
