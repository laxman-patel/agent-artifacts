import { createTeamWorkspaceInputSchema } from "@agent-artifacts/workspace";
import { LIST_LIMIT_OPTIONS } from "../command-options.js";
import type { CommandSpec } from "../command-spec.js";
import { resolveListLimit, sliceListResult } from "../list-limit.js";

export const workspaceListCommand: CommandSpec = {
  name: "workspace list",
  description: "List workspaces you belong to",
  options: LIST_LIMIT_OPTIONS,
  http: { method: "GET", pathTemplate: "/api/workspaces" },
  mutates: false,
  example: "artifacts workspace list --limit 50",
  async run({ client, options, config }) {
    const limitResult = resolveListLimit(options);
    const data = await client.get<{ workspaces: unknown[] }>("/api/workspaces");
    const workspaces = Array.isArray(data.workspaces) ? data.workspaces : [];
    const { items } = sliceListResult(workspaces, limitResult, config, "workspaces");
    return { data: { ...data, workspaces: items } };
  }
};

export const workspaceCreateCommand: CommandSpec = {
  name: "workspace create",
  description: "Create a team workspace",
  options: [
    { flag: "--json <payload>", description: "JSON body", required: true },
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" }
  ],
  bodySchema: createTeamWorkspaceInputSchema,
  http: { method: "POST", pathTemplate: "/api/workspaces" },
  mutates: true,
  example: 'artifacts workspace create --json \'{"slug":"acme","name":"Acme Team"}\'',
  async run({ client, body }) {
    const parsed = createTeamWorkspaceInputSchema.parse(body);
    const data = await client.post<Record<string, unknown>>("/api/workspaces", parsed);
    return { data: { ...data, created: true } };
  }
};
