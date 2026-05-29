import type { NextAction } from "./output.js";

export function extractArtifactId(data: unknown): string | undefined {
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    if (typeof record.artifactId === "string") return record.artifactId;
    if (typeof record.id === "string") return record.id;
    if (typeof record.artifact === "object" && record.artifact !== null) {
      return extractArtifactId(record.artifact);
    }
  }
  return undefined;
}

export function extractShareLinkId(data: unknown): string | undefined {
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    if (typeof record.shareLinkId === "string") return record.shareLinkId;
    if (typeof record.id === "string") return record.id;
  }
  return undefined;
}

export function nextActionsForShareCreate(artifactId: string, data: unknown): NextAction[] {
  const shareLinkId = extractShareLinkId(data);
  const actions: NextAction[] = [
    {
      command: `artifacts share list --artifact-id ${artifactId}`,
      description: "List share links for artifact"
    }
  ];
  if (shareLinkId) {
    actions.push({
      command: `artifacts share revoke --share-link-id ${shareLinkId}`,
      description: "Revoke this share link"
    });
  }
  return actions;
}

export function nextActionsForArtifactList(artifacts: unknown[]): NextAction[] | undefined {
  if (artifacts.length === 0) return undefined;
  const artifactId = extractArtifactId(artifacts[0]);
  if (!artifactId) return undefined;
  return [{ command: `artifacts artifact get --artifact-id ${artifactId}`, description: "Open first listed artifact" }];
}

export function nextActionsForArtifact(artifactId: string | undefined): NextAction[] | undefined {
  if (!artifactId) return undefined;
  return [
    { command: `artifacts artifact get --artifact-id ${artifactId}`, description: "Read artifact metadata" },
    { command: `artifacts artifact content --artifact-id ${artifactId}`, description: "Read latest content" },
    { command: `artifacts artifact versions --artifact-id ${artifactId}`, description: "List versions" }
  ];
}

export function nextActionsForProject(data: unknown): NextAction[] | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const record = data as Record<string, unknown>;
  const owner = typeof record.ownerUsername === "string" ? record.ownerUsername : undefined;
  const slug = typeof record.normalizedSlug === "string" ? record.normalizedSlug : undefined;
  if (!owner || !slug) return undefined;
  return [
    {
      command: `artifacts path project --owner ${owner} --project-slug ${slug}`,
      description: "List artifacts in project"
    }
  ];
}
