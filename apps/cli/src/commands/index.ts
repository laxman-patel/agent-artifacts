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
  artifactPushCommand,
  artifactRestoreCommand,
  artifactSlugAvailabilityCommand,
  artifactUpdateCommand,
  artifactUrlPreviewCommand,
  artifactVersionsCommand
} from "./artifact.js";
import { healthCommand } from "./health.js";
import { keysCreateCommand, keysListCommand, keysRevokeCommand } from "./keys.js";
import { loginCommand } from "./login.js";
import { logoutCommand } from "./logout.js";
import { pathArtifactCommand, pathProjectCommand } from "./path.js";
import { profileGetCommand } from "./profile-get.js";
import { profileSetUsernameCommand } from "./profile-set-username.js";
import { projectCreateCommand, projectListCommand, projectSlugAvailabilityCommand } from "./project.js";
import { setupCommand } from "./setup.js";
import { shareCreateCommand, shareListCommand, shareRevokeCommand } from "./share.js";
import { statusCommand } from "./status.js";
import { whoamiCommand } from "./whoami.js";
import {
  workspaceAuditCommand,
  workspaceInviteCommand,
  workspaceListCommand,
  workspaceMembersCommand,
  workspaceRevokeInviteCommand
} from "./workspace.js";

export const allCommands: CommandSpec[] = [
  setupCommand,
  artifactPushCommand,
  loginCommand,
  logoutCommand,
  whoamiCommand,
  statusCommand,
  healthCommand,
  keysListCommand,
  keysCreateCommand,
  keysRevokeCommand,
  profileGetCommand,
  profileSetUsernameCommand,
  projectListCommand,
  projectCreateCommand,
  projectSlugAvailabilityCommand,
  workspaceListCommand,
  workspaceMembersCommand,
  workspaceInviteCommand,
  workspaceRevokeInviteCommand,
  workspaceAuditCommand,
  artifactListCommand,
  artifactGetCommand,
  artifactCreateCommand,
  artifactUpdateCommand,
  artifactRestoreCommand,
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
