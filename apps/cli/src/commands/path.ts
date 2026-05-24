import type { CommandSpec } from "../command-spec.js";
import { extractArtifactId, nextActionsForArtifact } from "../next-actions.js";
import { requirePositional } from "../args.js";

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
    const owner = requirePositional(positionals, 0, "owner", "artifacts path project alice default");
    const projectSlug = requirePositional(positionals, 1, "projectSlug", "artifacts path project alice default");
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
    const owner = requirePositional(positionals, 0, "owner", "artifacts path artifact alice default readme");
    const projectSlug = requirePositional(positionals, 1, "projectSlug", "artifacts path artifact alice default readme");
    const slug = requirePositional(positionals, 2, "slug", "artifacts path artifact alice default readme");
    const data = await client.get(
      `/api/by-path/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`
    );
    return { data, nextActions: nextActionsForArtifact(extractArtifactId(data)) };
  }
};
