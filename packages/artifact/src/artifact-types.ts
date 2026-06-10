import type { ArtifactType, Principal } from "@agent-artifacts/shared";
import { artifactTypeSchema } from "@agent-artifacts/shared";
import { BILLING_PLANS } from "@agent-artifacts/billing";
import { z } from "zod";

const artifactAccessInputSchema = z
  .object({
    publicView: z.boolean().default(true),
    publicEdit: z.boolean().default(false)
  })
  .default({ publicView: true, publicEdit: false });

/** Max artifact source size in bytes across all plans. Plan-specific limits are enforced by billing guards. */
export const MAX_ARTIFACT_CONTENT_BYTES = BILLING_PLANS.studio.entitlements.maxContentBytes;

const artifactContentSchema = z
  .string()
  .min(1)
  .refine(
    (value) => Buffer.byteLength(value, "utf-8") <= MAX_ARTIFACT_CONTENT_BYTES,
    `Content exceeds ${MAX_ARTIFACT_CONTENT_BYTES} byte limit.`
  );

export const createArtifactInputSchema = z.object({
  ownerUsername: z.string().min(1),
  projectSlug: z.string().min(1),
  slug: z.string().min(1),
  type: artifactTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  content: artifactContentSchema,
  changelog: z.string().max(1000).optional(),
  access: artifactAccessInputSchema
});

export type CreateArtifactInput = z.infer<typeof createArtifactInputSchema>;

export const createWorkspaceArtifactInputSchema = createArtifactInputSchema.omit({
  ownerUsername: true
});

export type CreateWorkspaceArtifactInput = z.infer<typeof createWorkspaceArtifactInputSchema>;

export const updateArtifactInputSchema = z.object({
  artifactId: z.string().min(1),
  content: artifactContentSchema,
  changelog: z.string().max(1000).optional(),
  expectedLatestVersion: z.number().int().positive().optional()
});

export type UpdateArtifactInput = z.infer<typeof updateArtifactInputSchema>;

export const restoreArtifactVersionInputSchema = z.object({
  artifactId: z.string().min(1),
  versionNumber: z.number().int().positive()
});

export type RestoreArtifactVersionInput = z.infer<typeof restoreArtifactVersionInputSchema>;

export const setArtifactAccessInputSchema = z.object({
  publicView: z.boolean(),
  publicEdit: z.boolean(),
  viewerEmails: z.array(z.email()).default([])
});

export type SetArtifactAccessInput = z.infer<typeof setArtifactAccessInputSchema>;

export interface ArtifactAccessSnapshot {
  publicView: boolean;
  publicEdit: boolean;
  viewerEmails: string[];
}

export interface ArtifactSummary {
  artifactId: string;
  versionId: string;
  versionNumber: number;
  ownerUserId: string;
  ownerUsername: string;
  projectId: string;
  projectSlug: string;
  normalizedSlug: string;
  type: ArtifactType;
  title: string;
  url: string;
  contentObjectKey: string;
  contentSha256: string;
  contentBytes: number;
  publicView: boolean;
  publicEdit: boolean;
}

export interface ArtifactRepository {
  getProjectByOwnerSlug(
    username: string,
    projectSlug: string
  ): Promise<{ id: string; slug: string; workspaceId: string; ownerUserId: string } | undefined>;
  getProjectByWorkspaceSlug(
    workspaceId: string,
    projectSlug: string
  ): Promise<{ id: string; slug: string; workspaceId: string; ownerUserId: string } | undefined>;
  slugExistsInProject(projectId: string, normalizedSlug: string): Promise<boolean>;
  getArtifactById(artifactId: string): Promise<ArtifactRecord | undefined>;
  getArtifactByOwnerProjectSlug(
    username: string,
    projectSlug: string,
    slug: string
  ): Promise<ArtifactRecord | undefined>;
  getArtifactByWorkspaceProjectSlug(
    workspaceId: string,
    projectSlug: string,
    slug: string
  ): Promise<ArtifactRecord | undefined>;
  getVersion(artifactId: string, versionNumber?: number): Promise<ArtifactVersionRecord | undefined>;
  listVersions(artifactId: string, limit: number, options?: { createdAtGte?: Date }): Promise<ArtifactVersionRecord[]>;
  createArtifact(input: PersistCreateArtifactInput): Promise<void>;
  createVersion(input: PersistCreateVersionInput): Promise<void>;
  createAuditEvent(input: PersistAuditEventInput): Promise<void>;
  listArtifactsForOwner(ownerUserId: string): Promise<ArtifactRecord[]>;
  listArtifactsForProject(projectId: string): Promise<ArtifactRecord[]>;
  listArtifactsForWorkspace(workspaceId: string): Promise<ArtifactRecord[]>;
  listViewerEmailsForArtifact(artifactId: string): Promise<string[]>;
  replaceArtifactEmailAccess(input: ReplaceArtifactEmailAccessInput): Promise<void>;
  softDeleteArtifact(artifactId: string): Promise<void>;
}

export interface ReplaceArtifactEmailAccessInput {
  artifactId: string;
  publicView: boolean;
  publicEdit: boolean;
  viewerEmails: string[];
  actorPrincipalType: Principal["type"];
  actorPrincipalId: string;
}

export class SlugUnavailableError extends Error {
  constructor(slug: string) {
    super(`Slug "${slug}" is not available.`);
    this.name = "SlugUnavailableError";
  }
}

export class ArtifactNotFoundError extends Error {
  constructor() {
    super("Artifact was not found.");
    this.name = "ArtifactNotFoundError";
  }
}

export class ArtifactConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactConflictError";
  }
}

export { ArtifactForbiddenError } from "@agent-artifacts/shared";

export interface ArtifactRecord {
  id: string;
  ownerUserId: string;
  ownerUsername: string;
  projectId: string;
  projectSlug: string;
  workspaceId: string;
  workspaceSlug: string;
  slug: string;
  title: string;
  description: string | null;
  type: ArtifactType;
  state: "active" | "archived" | "deleted";
  latestVersionId: string | null;
  publicView: boolean;
  publicEdit: boolean;
  createdByPrincipalType: Principal["type"];
  createdByPrincipalId: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface ArtifactVersionRecord {
  id: string;
  artifactId: string;
  versionNumber: number;
  parentVersionId: string | null;
  contentObjectKey: string;
  contentSha256: string;
  contentBytes: number;
  changelog: string | null;
  createdByPrincipalType: Principal["type"];
  createdByPrincipalId: string;
  createdAt: Date;
}

export interface PersistCreateArtifactInput {
  artifact: {
    id: string;
    ownerUserId: string;
    projectId: string;
    slug: string;
    title: string;
    description?: string;
    type: ArtifactType;
    latestVersionId: string;
    createdByPrincipalType: Principal["type"];
    createdByPrincipalId: string;
    publicView: boolean;
    publicEdit: boolean;
  };
  version: PersistCreateVersionInput["version"];
}

export interface PersistCreateVersionInput {
  version: {
    id: string;
    artifactId: string;
    versionNumber: number;
    parentVersionId?: string;
    contentObjectKey: string;
    contentSha256: string;
    contentBytes: number;
    changelog?: string;
    createdByPrincipalType: Principal["type"];
    createdByPrincipalId: string;
  };
  expectedLatestVersionId?: string;
}

export interface PersistAuditEventInput {
  id: string;
  ownerUserId: string;
  workspaceId?: string;
  artifactId?: string;
  actorPrincipalType: Principal["type"];
  actorPrincipalId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export function contentTypeForArtifact(type: ArtifactType): string {
  switch (type) {
    case "html":
      return "text/html; charset=utf-8";
    case "md":
      return "text/markdown; charset=utf-8";
    case "jsx":
      return "text/jsx; charset=utf-8";
  }
}
