import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { artifactPermissions, artifacts, artifactVersions, auditEvents, userProfiles } from "@agent-artifacts/db";
import { canPerformArtifactAction } from "@agent-artifacts/policy";
import type { ArtifactAction, ArtifactRole, ArtifactType, Principal } from "@agent-artifacts/shared";
import { artifactRoleSchema, artifactTypeSchema, buildArtifactUrl, normalizeSlug, slugSchema } from "@agent-artifacts/shared";
import type { ArtifactStorage } from "@agent-artifacts/storage";
import { createVersionSourceKey } from "@agent-artifacts/storage";
import { createTwoFilesPatch } from "diff";
import { z } from "zod";

const textDecoder = new TextDecoder();

const artifactAccessInputSchema = z
  .object({
    publicView: z.boolean().default(true),
    publicEdit: z.boolean().default(false)
  })
  .default({ publicView: true, publicEdit: false });

export const createArtifactInputSchema = z.object({
  ownerUsername: z.string().min(1),
  slug: z.string().min(1),
  type: artifactTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  content: z.string().min(1),
  changelog: z.string().max(1000).optional(),
  access: artifactAccessInputSchema
});

export type CreateArtifactInput = z.infer<typeof createArtifactInputSchema>;

export const updateArtifactInputSchema = z.object({
  artifactId: z.string().min(1),
  content: z.string().min(1),
  changelog: z.string().max(1000).optional(),
  expectedLatestVersion: z.number().int().positive().optional()
});

export type UpdateArtifactInput = z.infer<typeof updateArtifactInputSchema>;

export const setArtifactAccessInputSchema = z.object({
  publicView: z.boolean(),
  publicEdit: z.boolean(),
  viewerEmails: z.array(z.string().email()).default([])
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
  getOwnerByUsername(username: string): Promise<{ userId: string; username: string } | undefined>;
  slugExists(ownerUserId: string, normalizedSlug: string): Promise<boolean>;
  getArtifactById(artifactId: string): Promise<ArtifactRecord | undefined>;
  getArtifactByOwnerSlug(username: string, slug: string): Promise<ArtifactRecord | undefined>;
  getVersion(artifactId: string, versionNumber?: number): Promise<ArtifactVersionRecord | undefined>;
  listVersions(artifactId: string, limit: number): Promise<ArtifactVersionRecord[]>;
  createArtifact(input: PersistCreateArtifactInput): Promise<void>;
  createVersion(input: PersistCreateVersionInput): Promise<void>;
  getEffectiveRole(artifact: ArtifactRecord, principal: Principal): Promise<ArtifactRole | undefined>;
  createAuditEvent(input: PersistAuditEventInput): Promise<void>;
  listArtifactsForOwner(ownerUserId: string): Promise<ArtifactRecord[]>;
  listViewerEmailsForArtifact(artifactId: string): Promise<string[]>;
  replaceArtifactEmailAccess(input: ReplaceArtifactEmailAccessInput): Promise<void>;
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

export class ArtifactForbiddenError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ArtifactForbiddenError";
  }
}

export interface ArtifactRecord {
  id: string;
  ownerUserId: string;
  ownerUsername: string;
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
}

export interface PersistAuditEventInput {
  id: string;
  ownerUserId: string;
  artifactId?: string;
  actorPrincipalType: Principal["type"];
  actorPrincipalId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export class ArtifactService {
  constructor(
    private readonly repository: ArtifactRepository,
    private readonly storage: ArtifactStorage,
    private readonly appUrl: string
  ) {}

  async checkSlugAvailability(
    ownerUsername: string,
    slug: string,
    principal: Principal
  ): Promise<{ available: boolean; ownerUserId: string; normalizedSlug: string }> {
    const normalizedSlug = validateSlug(slug);
    const owner = await this.requireOwner(ownerUsername);
    this.assertAllowed(principal, "artifact.create", "owner", owner.userId === principal.id || owner.userId === principal.ownerUserId);
    const available = !(await this.repository.slugExists(owner.userId, normalizedSlug));

    return { available, ownerUserId: owner.userId, normalizedSlug };
  }

  async createArtifact(input: CreateArtifactInput, principal: Principal): Promise<ArtifactSummary> {
    const parsed = createArtifactInputSchema.parse(input);
    const owner = await this.requireOwner(parsed.ownerUsername);
    this.assertAllowed(principal, "artifact.create", "owner", owner.userId === principal.id || owner.userId === principal.ownerUserId);

    const normalizedSlug = validateSlug(parsed.slug);
    const available = !(await this.repository.slugExists(owner.userId, normalizedSlug));
    if (!available) {
      throw new SlugUnavailableError(normalizedSlug);
    }

    const artifactId = randomUUID();
    const versionId = randomUUID();
    const content = await this.writeContent({
      ownerUserId: owner.userId,
      artifactId,
      versionNumber: 1,
      type: parsed.type,
      content: parsed.content
    });

    await this.repository.createArtifact({
      artifact: {
        id: artifactId,
        ownerUserId: owner.userId,
        slug: normalizedSlug,
        title: parsed.title,
        description: parsed.description,
        type: parsed.type,
        latestVersionId: versionId,
        createdByPrincipalType: principal.type,
        createdByPrincipalId: principal.id,
        publicView: parsed.access.publicView,
        publicEdit: parsed.access.publicEdit
      },
      version: {
        id: versionId,
        artifactId,
        versionNumber: 1,
        contentObjectKey: content.contentObjectKey,
        contentSha256: content.contentSha256,
        contentBytes: content.contentBytes,
        changelog: parsed.changelog,
        createdByPrincipalType: principal.type,
        createdByPrincipalId: principal.id
      }
    });

    await this.audit(owner.userId, artifactId, principal, "artifact.created", "artifact", artifactId, {
      slug: normalizedSlug,
      versionNumber: 1
    });

    return {
      artifactId,
      versionId,
      versionNumber: 1,
      ownerUserId: owner.userId,
      ownerUsername: owner.username,
      normalizedSlug,
      type: parsed.type,
      title: parsed.title,
      url: buildArtifactUrl(this.appUrl, owner.username, normalizedSlug),
      contentObjectKey: content.contentObjectKey,
      contentSha256: content.contentSha256,
      contentBytes: content.contentBytes,
      publicView: parsed.access.publicView,
      publicEdit: parsed.access.publicEdit
    };
  }

  async updateArtifact(input: UpdateArtifactInput, principal: Principal): Promise<ArtifactSummary> {
    const parsed = updateArtifactInputSchema.parse(input);
    const artifact = await this.requireArtifactById(parsed.artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.update");

    const latestVersion = await this.requireVersion(artifact.id);
    if (parsed.expectedLatestVersion !== undefined && parsed.expectedLatestVersion !== latestVersion.versionNumber) {
      throw new ArtifactConflictError(`Expected latest version ${parsed.expectedLatestVersion}, got ${latestVersion.versionNumber}.`);
    }

    const nextVersionNumber = latestVersion.versionNumber + 1;
    const versionId = randomUUID();
    const content = await this.writeContent({
      ownerUserId: artifact.ownerUserId,
      artifactId: artifact.id,
      versionNumber: nextVersionNumber,
      type: artifact.type,
      content: parsed.content
    });

    await this.repository.createVersion({
      version: {
        id: versionId,
        artifactId: artifact.id,
        versionNumber: nextVersionNumber,
        parentVersionId: latestVersion.id,
        contentObjectKey: content.contentObjectKey,
        contentSha256: content.contentSha256,
        contentBytes: content.contentBytes,
        changelog: parsed.changelog,
        createdByPrincipalType: principal.type,
        createdByPrincipalId: principal.id
      }
    });

    await this.audit(artifact.ownerUserId, artifact.id, principal, "artifact.updated", "artifact_version", versionId, {
      previousVersionNumber: latestVersion.versionNumber,
      versionNumber: nextVersionNumber
    });

    return {
      artifactId: artifact.id,
      versionId,
      versionNumber: nextVersionNumber,
      ownerUserId: artifact.ownerUserId,
      ownerUsername: artifact.ownerUsername,
      normalizedSlug: artifact.slug,
      type: artifact.type,
      title: artifact.title,
      url: buildArtifactUrl(this.appUrl, artifact.ownerUsername, artifact.slug),
      contentObjectKey: content.contentObjectKey,
      contentSha256: content.contentSha256,
      contentBytes: content.contentBytes,
      publicView: artifact.publicView,
      publicEdit: artifact.publicEdit
    };
  }

  async getArtifactByPath(username: string, slug: string, principal: Principal): Promise<ArtifactRecord> {
    const artifact = await this.repository.getArtifactByOwnerSlug(username, validateSlug(slug));
    if (!artifact || artifact.state !== "active") {
      throw new ArtifactNotFoundError();
    }

    await this.assertArtifactAction(artifact, principal, "artifact.view");
    return artifact;
  }

  async getArtifact(artifactId: string, principal: Principal): Promise<ArtifactRecord> {
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.view");
    return artifact;
  }

  async checkArtifactPermission(artifactId: string, action: ArtifactAction, principal: Principal): Promise<boolean> {
    const artifact = await this.repository.getArtifactById(artifactId);
    if (!artifact || artifact.state !== "active") return false;
    const role = await this.repository.getEffectiveRole(artifact, principal);
    const decision = canPerformArtifactAction({
      principal,
      action,
      role,
      isOwnerAccount: artifact.ownerUserId === principal.id || artifact.ownerUserId === principal.ownerUserId
    });
    return decision.allowed;
  }

  async getArtifactContent(
    artifactId: string,
    principal: Principal,
    versionNumber?: number
  ): Promise<{ artifact: ArtifactRecord; version: ArtifactVersionRecord; content: string; contentType: string }> {
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.view");
    const version = await this.requireVersion(artifact.id, versionNumber);
    const object = await this.storage.getObject(version.contentObjectKey);

    return {
      artifact,
      version,
      content: textDecoder.decode(object.body),
      contentType: object.contentType ?? contentTypeForArtifact(artifact.type)
    };
  }

  async listArtifactVersions(artifactId: string, principal: Principal, limit = 50): Promise<ArtifactVersionRecord[]> {
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.view");
    return this.repository.listVersions(artifactId, Math.min(Math.max(limit, 1), 100));
  }

  async listOwnedArtifacts(principal: Principal): Promise<ArtifactRecord[]> {
    if (principal.type !== "user") {
      throw new ArtifactForbiddenError("Only signed-in users can list owned artifacts.");
    }

    return this.repository.listArtifactsForOwner(principal.id);
  }

  async getArtifactAccess(artifactId: string, principal: Principal): Promise<ArtifactAccessSnapshot> {
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.manage_access");
    const viewerEmails = await this.repository.listViewerEmailsForArtifact(artifactId);

    return {
      publicView: artifact.publicView,
      publicEdit: artifact.publicEdit,
      viewerEmails
    };
  }

  async setArtifactAccess(
    artifactId: string,
    input: SetArtifactAccessInput,
    principal: Principal
  ): Promise<ArtifactAccessSnapshot> {
    const parsed = setArtifactAccessInputSchema.parse(input);
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.manage_access");

    const normalizedEmails = parsed.viewerEmails.map((email) => email.trim().toLowerCase());

    await this.repository.replaceArtifactEmailAccess({
      artifactId,
      publicView: parsed.publicView,
      publicEdit: parsed.publicEdit,
      viewerEmails: normalizedEmails,
      actorPrincipalType: principal.type,
      actorPrincipalId: principal.id
    });

    await this.audit(artifact.ownerUserId, artifact.id, principal, "artifact.access_updated", "artifact", artifactId, {
      publicView: parsed.publicView,
      publicEdit: parsed.publicEdit,
      viewerEmails: normalizedEmails
    });

    return {
      publicView: parsed.publicView,
      publicEdit: parsed.publicEdit,
      viewerEmails: normalizedEmails
    };
  }

  async diffArtifactVersions(
    artifactId: string,
    principal: Principal,
    fromVersionNumber: number,
    toVersionNumber: number
  ): Promise<{ fromVersion: ArtifactVersionRecord; toVersion: ArtifactVersionRecord; unifiedDiff: string }> {
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.diff");

    const fromVersion = await this.requireVersion(artifact.id, fromVersionNumber);
    const toVersion = await this.requireVersion(artifact.id, toVersionNumber);

    const [fromObject, toObject] = await Promise.all([
      this.storage.getObject(fromVersion.contentObjectKey),
      this.storage.getObject(toVersion.contentObjectKey)
    ]);

    const left = textDecoder.decode(fromObject.body);
    const right = textDecoder.decode(toObject.body);

    const unifiedDiff = createTwoFilesPatch(`v${fromVersionNumber}`, `v${toVersionNumber}`, left, right, "", "");

    return { fromVersion, toVersion, unifiedDiff };
  }

  private async requireOwner(ownerUsername: string): Promise<{ userId: string; username: string }> {
    const owner = await this.repository.getOwnerByUsername(ownerUsername);
    if (!owner) {
      throw new ArtifactNotFoundError();
    }

    return owner;
  }

  private async requireArtifactById(artifactId: string): Promise<ArtifactRecord> {
    const artifact = await this.repository.getArtifactById(artifactId);
    if (!artifact || artifact.state !== "active") {
      throw new ArtifactNotFoundError();
    }

    return artifact;
  }

  private async requireVersion(artifactId: string, versionNumber?: number): Promise<ArtifactVersionRecord> {
    const version = await this.repository.getVersion(artifactId, versionNumber);
    if (!version) {
      throw new ArtifactNotFoundError();
    }

    return version;
  }

  private assertAllowed(
    principal: Principal,
    action: ArtifactAction,
    role: ArtifactRole | undefined,
    isOwnerAccount = false
  ): void {
    const decision = canPerformArtifactAction({
      principal,
      action,
      role,
      isOwnerAccount
    });

    if (!decision.allowed) {
      throw new ArtifactForbiddenError(decision.reason);
    }
  }

  private async assertArtifactAction(artifact: ArtifactRecord, principal: Principal, action: ArtifactAction): Promise<void> {
    const role = await this.repository.getEffectiveRole(artifact, principal);
    this.assertAllowed(principal, action, role, artifact.ownerUserId === principal.id || artifact.ownerUserId === principal.ownerUserId);
  }

  private async writeContent(input: {
    ownerUserId: string;
    artifactId: string;
    versionNumber: number;
    type: ArtifactType;
    content: string;
  }): Promise<{ contentObjectKey: string; contentSha256: string; contentBytes: number }> {
    const encodedContent = new TextEncoder().encode(input.content);
    const contentSha256 = createHash("sha256").update(encodedContent).digest("hex");
    const contentObjectKey = createVersionSourceKey(input);

    await this.storage.putObject({
      key: contentObjectKey,
      body: encodedContent,
      contentType: contentTypeForArtifact(input.type)
    });

    return {
      contentObjectKey,
      contentSha256,
      contentBytes: encodedContent.byteLength
    };
  }

  private async audit(
    ownerUserId: string,
    artifactId: string,
    principal: Principal,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.repository.createAuditEvent({
      id: randomUUID(),
      ownerUserId,
      artifactId,
      actorPrincipalType: principal.type,
      actorPrincipalId: principal.id,
      action,
      targetType,
      targetId,
      metadata
    });
  }
}

export class DrizzleArtifactRepository implements ArtifactRepository {
  constructor(private readonly db: Database) {}

  async getOwnerByUsername(username: string): Promise<{ userId: string; username: string } | undefined> {
    const normalizedUsername = username.trim().toLowerCase();
    const [owner] = await this.db
      .select({
        userId: userProfiles.userId,
        username: userProfiles.username
      })
      .from(userProfiles)
      .where(sql`lower(${userProfiles.username}) = ${normalizedUsername}`)
      .limit(1);

    return owner;
  }

  async slugExists(ownerUserId: string, normalizedSlug: string): Promise<boolean> {
    const [artifact] = await this.db
      .select({ id: artifacts.id })
      .from(artifacts)
      .where(and(eq(artifacts.ownerUserId, ownerUserId), sql`lower(${artifacts.slug}) = ${normalizedSlug}`))
      .limit(1);

    return artifact !== undefined;
  }

  async getArtifactById(artifactId: string): Promise<ArtifactRecord | undefined> {
    const [artifact] = await this.artifactQuery().where(eq(artifacts.id, artifactId)).limit(1);
    return artifact;
  }

  async getArtifactByOwnerSlug(username: string, slug: string): Promise<ArtifactRecord | undefined> {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedSlug = validateSlug(slug);
    const [artifact] = await this.artifactQuery()
      .where(and(sql`lower(${userProfiles.username}) = ${normalizedUsername}`, sql`lower(${artifacts.slug}) = ${normalizedSlug}`))
      .limit(1);

    return artifact;
  }

  async getVersion(artifactId: string, versionNumber?: number): Promise<ArtifactVersionRecord | undefined> {
    const conditions =
      versionNumber === undefined
        ? eq(artifactVersions.artifactId, artifactId)
        : and(eq(artifactVersions.artifactId, artifactId), eq(artifactVersions.versionNumber, versionNumber));

    const [version] = await this.db
      .select()
      .from(artifactVersions)
      .where(conditions)
      .orderBy(desc(artifactVersions.versionNumber))
      .limit(1);

    return version;
  }

  async listVersions(artifactId: string, limit: number): Promise<ArtifactVersionRecord[]> {
    return this.db
      .select()
      .from(artifactVersions)
      .where(eq(artifactVersions.artifactId, artifactId))
      .orderBy(desc(artifactVersions.versionNumber))
      .limit(limit);
  }

  async createArtifact(input: PersistCreateArtifactInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(artifacts).values(input.artifact);
      await tx.insert(artifactVersions).values(input.version);
      await tx.update(artifacts).set({ latestVersionId: input.version.id }).where(eq(artifacts.id, input.artifact.id));
    });
  }

  async createVersion(input: PersistCreateVersionInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(artifactVersions).values(input.version);
      await tx
        .update(artifacts)
        .set({
          latestVersionId: input.version.id,
          updatedAt: new Date()
        })
        .where(eq(artifacts.id, input.version.artifactId));
    });
  }

  async getEffectiveRole(artifact: ArtifactRecord, principal: Principal): Promise<ArtifactRole | undefined> {
    if (principal.id === artifact.ownerUserId || principal.ownerUserId === artifact.ownerUserId) {
      return "owner";
    }

    if (artifact.publicEdit) {
      return "editor";
    }

    if (artifact.publicView) {
      return "viewer";
    }

    const now = new Date();
    const permissionRows = await this.db
      .select({ role: artifactPermissions.role })
      .from(artifactPermissions)
      .where(
        and(
          eq(artifactPermissions.artifactId, artifact.id),
          isNull(artifactPermissions.revokedAt),
          or(isNull(artifactPermissions.expiresAt), sql`${artifactPermissions.expiresAt} > ${now}`),
          or(
            and(eq(artifactPermissions.subjectType, "user"), eq(artifactPermissions.subjectId, principal.id)),
            and(eq(artifactPermissions.subjectType, "agent"), eq(artifactPermissions.subjectId, principal.id)),
            and(eq(artifactPermissions.subjectType, "api_key"), eq(artifactPermissions.subjectId, principal.id)),
            and(eq(artifactPermissions.subjectType, "email"), sql`lower(${artifactPermissions.email}) = ${principal.email?.toLowerCase() ?? ""}`),
            eq(artifactPermissions.subjectType, "anyone")
          )
        )
      );

    return highestRole(permissionRows.map((permission) => permission.role));
  }

  async createAuditEvent(input: PersistAuditEventInput): Promise<void> {
    await this.db.insert(auditEvents).values(input);
  }

  async listArtifactsForOwner(ownerUserId: string): Promise<ArtifactRecord[]> {
    return this.db
      .select({
        id: artifacts.id,
        ownerUserId: artifacts.ownerUserId,
        ownerUsername: userProfiles.username,
        slug: artifacts.slug,
        title: artifacts.title,
        description: artifacts.description,
        type: artifacts.type,
        state: artifacts.state,
        latestVersionId: artifacts.latestVersionId,
        publicView: artifacts.publicView,
        publicEdit: artifacts.publicEdit,
        createdByPrincipalType: artifacts.createdByPrincipalType,
        createdByPrincipalId: artifacts.createdByPrincipalId,
        createdAt: artifacts.createdAt,
        updatedAt: artifacts.updatedAt,
        archivedAt: artifacts.archivedAt
      })
      .from(artifacts)
      .innerJoin(userProfiles, eq(userProfiles.userId, artifacts.ownerUserId))
      .where(and(eq(artifacts.ownerUserId, ownerUserId), eq(artifacts.state, "active")))
      .orderBy(desc(artifacts.updatedAt));
  }

  async listViewerEmailsForArtifact(artifactId: string): Promise<string[]> {
    const rows = await this.db
      .select({ email: artifactPermissions.email })
      .from(artifactPermissions)
      .where(
        and(
          eq(artifactPermissions.artifactId, artifactId),
          eq(artifactPermissions.subjectType, "email"),
          isNull(artifactPermissions.revokedAt)
        )
      );

    return rows.map((row) => row.email).filter((email): email is string => Boolean(email));
  }

  async replaceArtifactEmailAccess(input: ReplaceArtifactEmailAccessInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(artifacts)
        .set({
          publicView: input.publicView,
          publicEdit: input.publicEdit,
          updatedAt: new Date()
        })
        .where(eq(artifacts.id, input.artifactId));

      await tx
        .delete(artifactPermissions)
        .where(and(eq(artifactPermissions.artifactId, input.artifactId), eq(artifactPermissions.subjectType, "email")));

      const createdAt = new Date();

      for (const email of input.viewerEmails) {
        await tx.insert(artifactPermissions).values({
          id: randomUUID(),
          artifactId: input.artifactId,
          subjectType: "email",
          subjectId: null,
          email,
          role: "viewer",
          createdByPrincipalType: input.actorPrincipalType,
          createdByPrincipalId: input.actorPrincipalId,
          createdAt,
          expiresAt: null,
          revokedAt: null
        });
      }
    });
  }

  private artifactQuery() {
    return this.db
      .select({
        id: artifacts.id,
        ownerUserId: artifacts.ownerUserId,
        ownerUsername: userProfiles.username,
        slug: artifacts.slug,
        title: artifacts.title,
        description: artifacts.description,
        type: artifacts.type,
        state: artifacts.state,
        latestVersionId: artifacts.latestVersionId,
        publicView: artifacts.publicView,
        publicEdit: artifacts.publicEdit,
        createdByPrincipalType: artifacts.createdByPrincipalType,
        createdByPrincipalId: artifacts.createdByPrincipalId,
        createdAt: artifacts.createdAt,
        updatedAt: artifacts.updatedAt,
        archivedAt: artifacts.archivedAt
      })
      .from(artifacts)
      .innerJoin(userProfiles, eq(userProfiles.userId, artifacts.ownerUserId));
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

function highestRole(roles: ArtifactRole[]): ArtifactRole | undefined {
  const rank: Record<ArtifactRole, number> = {
    viewer: 1,
    editor: 2,
    admin: 3,
    owner: 4
  };

  return roles
    .map((role) => artifactRoleSchema.parse(role))
    .sort((left, right) => rank[right]! - rank[left]!)
    .at(0);
}
