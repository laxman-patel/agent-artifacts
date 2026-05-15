import { createHash, randomUUID } from "node:crypto";
import type { ArtifactType, Principal } from "@agent-artifacts/shared";
import { artifactTypeSchema, normalizeSlug, slugSchema } from "@agent-artifacts/shared";
import type { ArtifactStorage } from "@agent-artifacts/storage";
import { createVersionSourceKey } from "@agent-artifacts/storage";
import { z } from "zod";

export const createArtifactInputSchema = z.object({
  ownerUserId: z.string().min(1),
  slug: z.string().min(1),
  type: artifactTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  content: z.string().min(1),
  changelog: z.string().max(1000).optional()
});

export type CreateArtifactInput = z.infer<typeof createArtifactInputSchema>;

export interface PreparedArtifactVersion {
  artifactId: string;
  versionId: string;
  versionNumber: number;
  normalizedSlug: string;
  contentObjectKey: string;
  contentSha256: string;
  contentBytes: number;
  contentType: string;
}

export interface ArtifactRepository {
  slugExists(ownerUserId: string, normalizedSlug: string): Promise<boolean>;
}

export class SlugUnavailableError extends Error {
  constructor(slug: string) {
    super(`Slug "${slug}" is not available.`);
    this.name = "SlugUnavailableError";
  }
}

export class ArtifactService {
  constructor(
    private readonly repository: ArtifactRepository,
    private readonly storage: ArtifactStorage
  ) {}

  async checkSlugAvailability(ownerUserId: string, slug: string): Promise<{ available: boolean; normalizedSlug: string }> {
    const normalizedSlug = validateSlug(slug);
    const available = !(await this.repository.slugExists(ownerUserId, normalizedSlug));

    return { available, normalizedSlug };
  }

  async prepareInitialVersion(input: CreateArtifactInput, principal: Principal): Promise<PreparedArtifactVersion> {
    createArtifactInputSchema.parse(input);

    const normalizedSlug = validateSlug(input.slug);
    const { available } = await this.checkSlugAvailability(input.ownerUserId, normalizedSlug);
    if (!available) {
      throw new SlugUnavailableError(normalizedSlug);
    }

    const artifactId = randomUUID();
    const versionId = randomUUID();
    const versionNumber = 1;
    const encodedContent = new TextEncoder().encode(input.content);
    const contentSha256 = createHash("sha256").update(encodedContent).digest("hex");
    const contentObjectKey = createVersionSourceKey({
      ownerUserId: input.ownerUserId,
      artifactId,
      versionNumber
    });

    await this.storage.putObject({
      key: contentObjectKey,
      body: encodedContent,
      contentType: contentTypeForArtifact(input.type)
    });

    void principal;

    return {
      artifactId,
      versionId,
      versionNumber,
      normalizedSlug,
      contentObjectKey,
      contentSha256,
      contentBytes: encodedContent.byteLength,
      contentType: contentTypeForArtifact(input.type)
    };
  }
}

export function validateSlug(slug: string): string {
  const normalized = normalizeSlug(slug);
  return slugSchema.parse(normalized);
}

export function contentTypeForArtifact(type: ArtifactType): string {
  switch (type) {
    case "html":
      return "text/html; charset=utf-8";
    case "markdown":
      return "text/markdown; charset=utf-8";
    case "react":
      return "text/typescript-jsx; charset=utf-8";
  }
}
