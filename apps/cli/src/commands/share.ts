import { z } from "zod";
import type { CommandSpec } from "../command-spec.js";

export const shareLinkBodySchema = z.object({
  role: z.enum(["viewer", "editor"]).default("viewer"),
  expiresAt: z.iso.datetime().optional()
});

function requiredPos(positionals: string[], index: number): string {
  const value = positionals[index];
  if (value === undefined) {
    throw new Error(`Missing required positional argument at index ${index}`);
  }
  return value;
}

export const shareCreateCommand: CommandSpec = {
  name: "share create",
  description: "Create a share link",
  positional: [{ name: "artifactId", required: true }],
  options: [
    { flag: "--json <payload>", description: 'JSON e.g. {"role":"viewer"}', required: true },
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" }
  ],
  bodySchema: shareLinkBodySchema,
  http: { method: "POST", pathTemplate: "/api/artifacts/{artifactId}/share-links" },
  mutates: true,
  example: 'artifacts share create ARTIFACT_ID --json \'{"role":"viewer"}\'',
  async run({ client, positionals, body }) {
    const artifactId = requiredPos(positionals, 0);
    const data = await client.post(
      `/api/artifacts/${encodeURIComponent(artifactId)}/share-links`,
      shareLinkBodySchema.parse(body)
    );
    return { data };
  }
};

export const shareListCommand: CommandSpec = {
  name: "share list",
  description: "List share links",
  positional: [{ name: "artifactId", required: true }],
  http: { method: "GET", pathTemplate: "/api/artifacts/{artifactId}/share-links" },
  mutates: false,
  example: "artifacts share list ARTIFACT_ID",
  async run({ client, positionals }) {
    const artifactId = requiredPos(positionals, 0);
    const data = await client.get(`/api/artifacts/${encodeURIComponent(artifactId)}/share-links`);
    return { data };
  }
};

export const shareRevokeCommand: CommandSpec = {
  name: "share revoke",
  description: "Revoke a share link",
  positional: [{ name: "shareLinkId", required: true }],
  http: { method: "POST", pathTemplate: "/api/share-links/{shareLinkId}/revoke" },
  mutates: true,
  example: "artifacts share revoke SHARE_LINK_ID",
  async run({ client, positionals }) {
    const shareLinkId = requiredPos(positionals, 0);
    const data = await client.post(`/api/share-links/${encodeURIComponent(shareLinkId)}/revoke`, {});
    return { data };
  }
};
