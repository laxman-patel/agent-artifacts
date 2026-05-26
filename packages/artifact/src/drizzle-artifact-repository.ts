import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { artifactPermissions, artifacts, artifactVersions, auditEvents, projects, userProfiles } from "@agent-artifacts/db";
import {
  type ArtifactRecord,
  type ArtifactRepository,
  type ArtifactVersionRecord,
  type PersistAuditEventInput,
  type PersistCreateArtifactInput,
  type PersistCreateVersionInput,
  type ReplaceArtifactEmailAccessInput
} from "./artifact-types.js";
import { getOwnerByUsername, getProjectIdByOwnerSlug } from "./drizzle-owner-lookup.js";
import { validateProjectSlug } from "./project.js";
import { validateSlug } from "./slug.js";

export class DrizzleArtifactRepository implements ArtifactRepository {
  constructor(
    private readonly db: Database,
    private readonly logger?: { info: (msg: string, fields?: Record<string, unknown>) => void }
  ) {}

  async getOwnerByUsername(username: string): Promise<{ userId: string; username: string } | undefined> {
    return getOwnerByUsername(this.db, username);
  }

  async getProjectByOwnerSlug(
    username: string,
    projectSlug: string
  ): Promise<{ id: string; slug: string } | undefined> {
    return getProjectIdByOwnerSlug(this.db, username, projectSlug);
  }

  async slugExistsInProject(projectId: string, normalizedSlug: string): Promise<boolean> {
    const [artifact] = await this.db
      .select({ id: artifacts.id })
      .from(artifacts)
      .where(and(eq(artifacts.projectId, projectId), sql`lower(${artifacts.slug}) = ${normalizedSlug}`))
      .limit(1);

    return artifact !== undefined;
  }

  async getArtifactById(artifactId: string): Promise<ArtifactRecord | undefined> {
    const [artifact] = await this.artifactQuery().where(eq(artifacts.id, artifactId)).limit(1);
    return artifact;
  }

  async getArtifactByOwnerProjectSlug(
    username: string,
    projectSlug: string,
    slug: string
  ): Promise<ArtifactRecord | undefined> {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedSlug = validateSlug(slug);
    const [artifact] = await this.artifactQuery()
      .where(
        and(
          sql`lower(${userProfiles.username}) = ${normalizedUsername}`,
          sql`lower(${projects.slug}) = ${projectSlug}`,
          sql`lower(${artifacts.slug}) = ${normalizedSlug}`
        )
      )
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

  async createAuditEvent(input: PersistAuditEventInput): Promise<void> {
    await this.db.insert(auditEvents).values(input);
    this.logger?.info("audit_event", {
      ownerUserId: input.ownerUserId,
      artifactId: input.artifactId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      principalType: input.actorPrincipalType,
      principalId: input.actorPrincipalId
    });
  }

  async listArtifactsForOwner(ownerUserId: string): Promise<ArtifactRecord[]> {
    return this.artifactQuery()
      .where(and(eq(artifacts.ownerUserId, ownerUserId), eq(artifacts.state, "active")))
      .orderBy(desc(artifacts.updatedAt));
  }

  async listArtifactsForProject(projectId: string): Promise<ArtifactRecord[]> {
    return this.artifactQuery()
      .where(and(eq(artifacts.projectId, projectId), eq(artifacts.state, "active")))
      .orderBy(desc(artifacts.updatedAt));
  }

  private artifactQuery() {
    return this.db
      .select({
        id: artifacts.id,
        ownerUserId: artifacts.ownerUserId,
        ownerUsername: userProfiles.username,
        projectId: artifacts.projectId,
        projectSlug: projects.slug,
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
      .innerJoin(projects, eq(projects.id, artifacts.projectId));
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

  async softDeleteArtifact(artifactId: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(artifacts)
      .set({ state: "deleted", archivedAt: now, updatedAt: now })
      .where(eq(artifacts.id, artifactId));
  }
}
