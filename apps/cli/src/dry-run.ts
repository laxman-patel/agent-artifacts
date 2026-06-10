import type { CommandSpec } from "./command-spec.js";

export function buildDryRunPreview(
  spec: CommandSpec,
  body?: unknown,
  options?: Record<string, unknown>
): Record<string, unknown> {
  const preview: Record<string, unknown> = {
    dry_run: true,
    command: spec.name,
    mutates: spec.mutates
  };

  if (spec.http) {
    preview.http = {
      method: spec.http.method,
      path: interpolatePathTemplate(spec.http.pathTemplate, options)
    };
  }

  if (body !== undefined) {
    preview.body = body;
  }

  if (spec.example) {
    preview.example = spec.example;
  }

  return preview;
}

const PATH_PARAM_OPTION_KEYS: Record<string, string[]> = {
  username: ["owner"],
  ownerUsername: ["owner"],
  projectSlug: ["projectSlug", "project"],
  slug: ["slug"],
  artifactId: ["artifactId"],
  workspaceId: ["workspaceId"],
  invitationId: ["invitationId"],
  versionNumber: ["version"],
  shareLinkId: ["shareLinkId"],
  apiKeyId: ["apiKeyId"]
};

function interpolatePathTemplate(template: string, options?: Record<string, unknown>): string {
  const keys = [...template.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]!);
  let path = template;
  for (const key of keys) {
    const value = resolvePathParam(key, options) ?? `{${key}}`;
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  }
  return path;
}

function resolvePathParam(key: string, options?: Record<string, unknown>): string | undefined {
  const optionKeys = [key, ...(PATH_PARAM_OPTION_KEYS[key] ?? [])];
  for (const optionKey of optionKeys) {
    const value = options?.[optionKey];
    if ((typeof value === "string" && value.length > 0) || typeof value === "number") {
      return String(value);
    }
  }
  return undefined;
}
