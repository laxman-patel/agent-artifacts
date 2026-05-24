import { normalizeSlug, slugSchema } from "@agent-artifacts/shared";

export function validateSlug(slug: string): string {
  const normalized = normalizeSlug(slug);
  return slugSchema.parse(normalized);
}
