import type { CommandSpec } from "../command-spec.js";
import { auditListCommand } from "./audit.js";
import {
  artifactAccessGetCommand,
  artifactAccessSetCommand,
  artifactContentCommand,
  artifactCreateCommand,
  artifactDeleteCommand,
  artifactDiffCommand,
  artifactGetCommand,
  artifactListCommand,
  artifactSlugAvailabilityCommand,
  artifactUpdateCommand,
  artifactUrlPreviewCommand,
  artifactVersionsCommand
} from "./artifact.js";
import { healthCommand } from "./health.js";
import { loginCommand } from "./login.js";
import { logoutCommand } from "./logout.js";
import { pathArtifactCommand, pathProjectCommand } from "./path.js";
import { profileGetCommand } from "./profile-get.js";
import { profileSetUsernameCommand } from "./profile-set-username.js";
import { projectCreateCommand, projectListCommand, projectSlugAvailabilityCommand } from "./project.js";
import { setupCommand } from "./setup.js";
import { shareCreateCommand, shareListCommand, shareRevokeCommand } from "./share.js";
import { whoamiCommand } from "./whoami.js";

export const allCommands: CommandSpec[] = [
  setupCommand,
  loginCommand,
  logoutCommand,
  whoamiCommand,
  healthCommand,
  profileGetCommand,
  profileSetUsernameCommand,
  projectListCommand,
  projectCreateCommand,
  projectSlugAvailabilityCommand,
  artifactListCommand,
  artifactGetCommand,
  artifactCreateCommand,
  artifactUpdateCommand,
  artifactDeleteCommand,
  artifactContentCommand,
  artifactVersionsCommand,
  artifactDiffCommand,
  artifactSlugAvailabilityCommand,
  artifactUrlPreviewCommand,
  artifactAccessGetCommand,
  artifactAccessSetCommand,
  pathProjectCommand,
  pathArtifactCommand,
  shareCreateCommand,
  shareListCommand,
  shareRevokeCommand,
  auditListCommand
];

export type { CommandSpec } from "../command-spec.js";
