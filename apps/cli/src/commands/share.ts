import { z } from "zod";
import { requireFlag } from "../args.js";
import {
  ARTIFACT_ID_FLAG,
  ARTIFACT_ID_OPTION,
  SHARE_LINK_ID_FLAG,
  SHARE_LINK_ID_OPTION
} from "../command-options.js";
import { nextActionsForShareCreate } from "../next-actions.js";
import type { CommandSpec } from "../command-spec.js";

export const shareLinkBodySchema = z.object({
  role: z.enum(["viewer", "editor"]).default("viewer"),
  expiresAt: z.iso.datetime().optional()
});

export const shareCreateCommand: CommandSpec = {
  name: "share create",
  description: "Create a share link",
  options: [
    ARTIFACT_ID_OPTION,
    { flag: "--json <payload>", description: 'JSON e.g. {"role":"viewer"}', required: true },
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" }
  ],
  bodySchema: shareLinkBodySchema,
  http: { method: "POST", pathTemplate: "/api/artifacts/{artifactId}/share-links" },
  mutates: true,
  example: 'artifacts share create --artifact-id ARTIFACT_ID --json \'{"role":"viewer"}\'',
  async run({ client, options, body }) {
    const artifactId = requireFlag(options, ARTIFACT_ID_FLAG);
    const data = await client.post(
      `/api/artifacts/${encodeURIComponent(artifactId)}/share-links`,
      shareLinkBodySchema.parse(body)
    );
    return { data, nextActions: nextActionsForShareCreate(artifactId, data) };
  }
};

export const shareListCommand: CommandSpec = {
  name: "share list",
  description: "List share links",
  options: [ARTIFACT_ID_OPTION],
  http: { method: "GET", pathTemplate: "/api/artifacts/{artifactId}/share-links" },
  mutates: false,
  example: "artifacts share list --artifact-id ARTIFACT_ID",
  async run({ client, options }) {
    const artifactId = requireFlag(options, ARTIFACT_ID_FLAG);
    const data = await client.get(`/api/artifacts/${encodeURIComponent(artifactId)}/share-links`);
    return { data };
  }
};

export const shareRevokeCommand: CommandSpec = {
  name: "share revoke",
  description: "Revoke a share link",
  options: [SHARE_LINK_ID_OPTION],
  http: { method: "POST", pathTemplate: "/api/share-links/{shareLinkId}/revoke" },
  mutates: true,
  example: "artifacts share revoke --share-link-id SHARE_LINK_ID",
  async run({ client, options }) {
    const shareLinkId = requireFlag(options, SHARE_LINK_ID_FLAG);
    const data = await client.post(`/api/share-links/${encodeURIComponent(shareLinkId)}/revoke`, {});
    return { data };
  }
};
