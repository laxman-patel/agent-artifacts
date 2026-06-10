import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { artifactPermissions, artifacts, artifactVersions, auditEvents, projects, workspaces } from "@agent-artifacts/db";
import {
  ArtifactConflictError,
  type ArtifactRecord,
  type ArtifactRepository,
  type ArtifactVersionRecord,
  type PersistAuditEventInput,
  type PersistCreateArtifactInput,
  type PersistCreateVersionInput,
  type ReplaceArtifactEmailAccessInput
} from "./artifact-types.js";
import { validateProjectSlug } from "./project.js";
import { validateSlug } from "./slug.js";

export class DrizzleArtifactRepository implements ArtifactRepository {
  constructor(
    private readonly db: Database,
    private readonly logger?: { info: (msg: string, fields?: Record<string, unknown>) => void }
  ) {}

  async getProjectByOwnerSlug(
    username: string,
    projectSlug: string
  ): Promise<{ id: string; slug: string; workspaceId: string; ownerUserId: string } | undefined> {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedProjectSlug = validateProjectSlug(projectSlug);
    const [project] = await this.db
      .select({ id: projects.id, slug: projects.slug, workspaceId: projects.workspaceId, ownerUserId: projects.ownerUserId })
      .from(projects)
      .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId))
      .where(
        and(
          sql`lower(${workspaces.slug}) = ${normalizedUsername}`,
          sql`lower(${projects.slug}) = ${normalizedProjectSlug}`,
          eq(workspaces.state, "active")
        )
      )
      .limit(1);

    return project;
  }

  async getProjectByWorkspaceSlug(
    workspaceId: string,
    projectSlug: string
  ): Promise<{ id: string; slug: string; workspaceId: string; ownerUserId: string } | undefined> {
    const normalizedProjectSlug = validateProjectSlug(projectSlug);
    const [project] = await this.db
      .select({ id: projects.id, slug: projects.slug, workspaceId: projects.workspaceId, ownerUserId: projects.ownerUserId })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), sql`lower(${projects.slug}) = ${normalizedProjectSlug}`))
      .limit(1);

    return project?.workspaceId ? { ...project, workspaceId: project.workspaceId } : undefined;
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
          sql`lower(${workspaces.slug}) = ${normalizedUsername}`,
          sql`lower(${projects.slug}) = ${projectSlug}`,
          sql`lower(${artifacts.slug}) = ${normalizedSlug}`,
          eq(workspaces.state, "active")
        )
      )
      .limit(1);

    return artifact;
  }

  async getArtifactByWorkspaceProjectSlug(
    workspaceId: string,
    projectSlug: string,
    slug: string
  ): Promise<ArtifactRecord | undefined> {
    const normalizedProjectSlug = validateProjectSlug(projectSlug);
    const normalizedSlug = validateSlug(slug);
    const [artifact] = await this.artifactQuery()
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          sql`lower(${projects.slug}) = ${normalizedProjectSlug}`,
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

  async listVersions(artifactId: string, limit: number, options: { createdAtGte?: Date } = {}): Promise<ArtifactVersionRecord[]> {
    const conditions = [eq(artifactVersions.artifactId, artifactId)];
    if (options.createdAtGte) {
      conditions.push(gte(artifactVersions.createdAt, options.createdAtGte));
    }

    return this.db
      .select()
      .from(artifactVersions)
      .where(and(...conditions))
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
    try {
      await this.db.transaction(async (tx) => {
        const conditions = [eq(artifacts.id, input.version.artifactId)];
        if (input.expectedLatestVersionId) {
          conditions.push(eq(artifacts.latestVersionId, input.expectedLatestVersionId));
        }

        const updated = await tx
          .update(artifacts)
          .set({
            latestVersionId: input.version.id,
            updatedAt: new Date()
          })
          .where(and(...conditions))
          .returning({ id: artifacts.id });

        if (updated.length === 0) {
          throw new ArtifactConflictError("The artifact was updated by another writer.");
        }

        await tx.insert(artifactVersions).values(input.version);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ArtifactConflictError("The artifact was updated by another writer.");
      }
      throw error;
    }
  }

  async createAuditEvent(input: PersistAuditEventInput): Promise<void> {
    await this.db.insert(auditEvents).values(input);
    this.logger?.info("audit_event", {
      ownerUserId: input.ownerUserId,
      workspaceId: input.workspaceId,
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

  async listArtifactsForWorkspace(workspaceId: string): Promise<ArtifactRecord[]> {
    return this.artifactQuery()
      .where(and(eq(projects.workspaceId, workspaceId), eq(artifacts.state, "active")))
      .orderBy(desc(artifacts.updatedAt));
  }

  private artifactQuery() {
    return this.db
      .select({
        id: artifacts.id,
        ownerUserId: artifacts.ownerUserId,
        ownerUsername: workspaces.slug,
        projectId: artifacts.projectId,
        projectSlug: projects.slug,
        workspaceId: projects.workspaceId,
        workspaceSlug: workspaces.slug,
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
      .innerJoin(projects, eq(projects.id, artifacts.projectId))
      .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId));
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

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
