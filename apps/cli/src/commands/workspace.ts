import { createWorkspaceInvitationInputSchema } from "@agent-artifacts/workspace";
import { requireFlag } from "../args.js";
import { LIST_LIMIT_OPTIONS } from "../command-options.js";
import type { CommandSpec } from "../command-spec.js";
import { resolveListLimit } from "../list-limit.js";

const WORKSPACE_ID_FLAG = {
  optionKey: "workspaceId",
  flag: "--workspace-id",
  label: "workspace id",
  example: "artifacts workspace members --workspace-id WORKSPACE_ID"
};

const INVITATION_ID_FLAG = {
  optionKey: "invitationId",
  flag: "--invitation-id",
  label: "invitation id",
  example: "artifacts workspace revoke-invite --invitation-id INVITATION_ID"
};

const WORKSPACE_ID_OPTION = { flag: "--workspace-id <id>", description: "Workspace id", required: true };
const INVITATION_ID_OPTION = { flag: "--invitation-id <id>", description: "Workspace invitation id", required: true };

function readWorkspaceId(options: Record<string, unknown>): string {
  return requireFlag(options, WORKSPACE_ID_FLAG);
}

export const workspaceListCommand: CommandSpec = {
  name: "workspace list",
  description: "List workspaces for the authenticated user",
  http: { method: "GET", pathTemplate: "/api/workspaces" },
  mutates: false,
  example: "artifacts workspace list",
  async run({ client }) {
    const data = await client.get("/api/workspaces");
    return { data };
  }
};

export const workspaceMembersCommand: CommandSpec = {
  name: "workspace members",
  description: "List workspace members",
  options: [WORKSPACE_ID_OPTION],
  http: { method: "GET", pathTemplate: "/api/workspaces/{workspaceId}/members" },
  mutates: false,
  example: "artifacts workspace members --workspace-id WORKSPACE_ID",
  async run({ client, options }) {
    const workspaceId = readWorkspaceId(options);
    const data = await client.get(`/api/workspaces/${encodeURIComponent(workspaceId)}/members`);
    return { data };
  }
};

export const workspaceInviteCommand: CommandSpec = {
  name: "workspace invite",
  description: "Create a workspace invitation",
  options: [
    WORKSPACE_ID_OPTION,
    { flag: "--json <payload>", description: 'JSON e.g. {"email":"teammate@example.com","role":"member"}', required: true },
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" }
  ],
  bodySchema: createWorkspaceInvitationInputSchema,
  http: { method: "POST", pathTemplate: "/api/workspaces/{workspaceId}/invitations" },
  mutates: true,
  example:
    'artifacts workspace invite --workspace-id WORKSPACE_ID --json \'{"email":"teammate@example.com","role":"member"}\'',
  async run({ client, options, body }) {
    const workspaceId = readWorkspaceId(options);
    const data = await client.post(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
      createWorkspaceInvitationInputSchema.parse(body)
    );
    return { data };
  }
};

export const workspaceRevokeInviteCommand: CommandSpec = {
  name: "workspace revoke-invite",
  description: "Revoke a workspace invitation",
  options: [INVITATION_ID_OPTION],
  http: { method: "POST", pathTemplate: "/api/workspace-invitations/{invitationId}/revoke" },
  mutates: true,
  example: "artifacts workspace revoke-invite --invitation-id INVITATION_ID",
  async run({ client, options }) {
    const invitationId = requireFlag(options, INVITATION_ID_FLAG);
    const data = await client.post(`/api/workspace-invitations/${encodeURIComponent(invitationId)}/revoke`, {});
    return { data };
  }
};

export const workspaceAuditCommand: CommandSpec = {
  name: "workspace audit",
  description: "List workspace audit events",
  options: [
    WORKSPACE_ID_OPTION,
    { flag: "--artifact-id <id>", description: "Filter by artifact" },
    ...LIST_LIMIT_OPTIONS
  ],
  http: { method: "GET", pathTemplate: "/api/workspaces/{workspaceId}/audit-events" },
  mutates: false,
  example: "artifacts workspace audit --workspace-id WORKSPACE_ID --limit 50",
  async run({ client, options }) {
    const workspaceId = readWorkspaceId(options);
    const limitResult = resolveListLimit(options);
    const data = await client.get(`/api/workspaces/${encodeURIComponent(workspaceId)}/audit-events`, {
      artifactId: options.artifactId as string | undefined,
      limit: limitResult.apiLimit
    });
    return { data };
  }
};
