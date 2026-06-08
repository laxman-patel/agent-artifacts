export function artifactPath(artifact: {
  ownerUsername: string;
  projectSlug: string;
  slug: string;
}): string {
  return `/${artifact.ownerUsername}/${artifact.projectSlug}/${artifact.slug}`;
}

export function projectPath(project: { ownerUsername: string; slug: string }): string {
  return `/${project.ownerUsername}/${project.slug}`;
}
