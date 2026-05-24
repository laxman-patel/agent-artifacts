import type { CommandSpec } from "./command-spec.js";

export function buildDryRunPreview(
  spec: CommandSpec,
  positionals: string[],
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
      path: interpolatePathTemplate(spec.http.pathTemplate, positionals, options)
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
  shareLinkId: ["shareLinkId"]
};

function interpolatePathTemplate(
  template: string,
  positionals: string[],
  options?: Record<string, unknown>
): string {
  const keys = [...template.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]!);
  let path = template;
  keys.forEach((key, index) => {
    const value = resolvePathParam(key, index, positionals, options) ?? `{${key}}`;
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  });
  return path;
}

function resolvePathParam(
  key: string,
  index: number,
  positionals: string[],
  options?: Record<string, unknown>
): string | undefined {
  const positional = positionals[index];
  if (positional) return positional;

  const optionKeys = [key, ...(PATH_PARAM_OPTION_KEYS[key] ?? [])];
  for (const optionKey of optionKeys) {
    const value = options?.[optionKey];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}
