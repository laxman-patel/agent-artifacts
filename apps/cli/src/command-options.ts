import type { CommandSpec } from "./command-spec.js";

export const LIST_LIMIT_OPTIONS: NonNullable<CommandSpec["options"]> = [
  {
    flag: "--limit <n>",
    description: "Max records to return (default: 50; max: 100; use --all for every record)",
    parse: (v) => Number.parseInt(v, 10)
  },
  { flag: "--all", description: "Return every record — may be large" }
];

export const ARTIFACT_ID_OPTION = {
  flag: "--artifact-id <id>",
  description: "Artifact ID (alternative to positional argument)"
};

export const ARTIFACT_ID_ARG = {
  positionalIndex: 0,
  optionKey: "artifactId",
  label: "artifactId",
  flag: "--artifact-id",
  example: "artifacts artifact get --artifact-id ARTIFACT_ID"
} as const;

export const SHARE_LINK_ID_OPTION = {
  flag: "--share-link-id <id>",
  description: "Share link ID (alternative to positional argument)"
};

export const SHARE_LINK_ID_ARG = {
  positionalIndex: 0,
  optionKey: "shareLinkId",
  label: "shareLinkId",
  flag: "--share-link-id",
  example: "artifacts share revoke --share-link-id SHARE_LINK_ID"
} as const;

export const OWNER_OPTION = {
  flag: "--owner <username>",
  description: "Owner username (alternative to first positional)"
};

export const PROJECT_SLUG_OPTION = {
  flag: "--project-slug <slug>",
  description: "Project slug (alternative to project positional)"
};

export const SLUG_OPTION = {
  flag: "--slug <slug>",
  description: "Artifact slug (alternative to slug positional)"
};
