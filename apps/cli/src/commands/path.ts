import type { CommandSpec } from "../command-spec.js";
import { extractArtifactId, nextActionsForArtifact } from "../next-actions.js";

function requiredPos(positionals: string[], index: number): string {
  const value = positionals[index];
  if (value === undefined) {
    throw new Error(`Missing required positional argument at index ${index}`);
  }
  return value;
}

export const pathProjectCommand: CommandSpec = {
  name: "path project",
  description: "Get project and artifacts by path",
  positional: [
    { name: "owner", required: true },
    { name: "projectSlug", required: true }
  ],
  http: { method: "GET", pathTemplate: "/api/by-path/{username}/{projectSlug}" },
  mutates: false,
  example: "artifacts path project alice default",
  async run({ client, positionals }) {
    const owner = requiredPos(positionals, 0);
    const projectSlug = requiredPos(positionals, 1);
    const data = await client.get(`/api/by-path/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}`);
    return { data };
  }
};

export const pathArtifactCommand: CommandSpec = {
  name: "path artifact",
  description: "Get artifact by path",
  positional: [
    { name: "owner", required: true },
    { name: "projectSlug", required: true },
    { name: "slug", required: true }
  ],
  http: { method: "GET", pathTemplate: "/api/by-path/{username}/{projectSlug}/{slug}" },
  mutates: false,
  example: "artifacts path artifact alice default readme",
  async run({ client, positionals }) {
    const owner = requiredPos(positionals, 0);
    const projectSlug = requiredPos(positionals, 1);
    const slug = requiredPos(positionals, 2);
    const data = await client.get(
      `/api/by-path/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`
    );
    return { data, nextActions: nextActionsForArtifact(extractArtifactId(data)) };
  }
};
