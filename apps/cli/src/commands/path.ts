import { requireFlag } from "../args.js";
import { OWNER_OPTION, PROJECT_SLUG_OPTION, SLUG_OPTION } from "../command-options.js";
import type { CommandSpec } from "../command-spec.js";
import { extractArtifactId, nextActionsForArtifact } from "../next-actions.js";

const PROJECT_EXAMPLE = "artifacts path project --owner alice --project-slug default";
const ARTIFACT_EXAMPLE = "artifacts path artifact --owner alice --project-slug default --slug readme";

export const pathProjectCommand: CommandSpec = {
  name: "path project",
  description: "Get project and artifacts by path",
  options: [OWNER_OPTION, PROJECT_SLUG_OPTION],
  http: { method: "GET", pathTemplate: "/api/by-path/{username}/{projectSlug}" },
  mutates: false,
  example: PROJECT_EXAMPLE,
  async run({ client, options }) {
    const owner = requireFlag(options, {
      optionKey: "owner",
      label: "username",
      flag: "--owner",
      example: PROJECT_EXAMPLE
    });
    const projectSlug = requireFlag(options, {
      optionKey: "projectSlug",
      label: "slug",
      flag: "--project-slug",
      example: PROJECT_EXAMPLE
    });
    const data = await client.get(`/api/by-path/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}`);
    return { data };
  }
};

export const pathArtifactCommand: CommandSpec = {
  name: "path artifact",
  description: "Get artifact by path",
  options: [OWNER_OPTION, PROJECT_SLUG_OPTION, SLUG_OPTION],
  http: { method: "GET", pathTemplate: "/api/by-path/{username}/{projectSlug}/{slug}" },
  mutates: false,
  example: ARTIFACT_EXAMPLE,
  async run({ client, options }) {
    const owner = requireFlag(options, {
      optionKey: "owner",
      label: "username",
      flag: "--owner",
      example: ARTIFACT_EXAMPLE
    });
    const projectSlug = requireFlag(options, {
      optionKey: "projectSlug",
      label: "slug",
      flag: "--project-slug",
      example: ARTIFACT_EXAMPLE
    });
    const slug = requireFlag(options, {
      optionKey: "slug",
      label: "slug",
      flag: "--slug",
      example: ARTIFACT_EXAMPLE
    });
    const data = await client.get(
      `/api/by-path/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`
    );
    return { data, nextActions: nextActionsForArtifact(extractArtifactId(data)) };
  }
};
