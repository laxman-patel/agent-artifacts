import type { CommandSpec } from "./command-spec.js";

export function buildDryRunPreview(
  spec: CommandSpec,
  positionals: string[],
  body?: unknown
): Record<string, unknown> {
  const preview: Record<string, unknown> = {
    dry_run: true,
    command: spec.name,
    mutates: spec.mutates
  };

  if (spec.http) {
    preview.http = {
      method: spec.http.method,
      path: interpolatePathTemplate(spec.http.pathTemplate, positionals)
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

function interpolatePathTemplate(template: string, positionals: string[]): string {
  const keys = [...template.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]!);
  let path = template;
  keys.forEach((key, index) => {
    const value = positionals[index] ?? `{${key}}`;
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  });
  return path;
}
