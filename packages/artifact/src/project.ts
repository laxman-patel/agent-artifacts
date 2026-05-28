import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { projects, userProfiles, workspaces } from "@agent-artifacts/db";
import type { Principal } from "@agent-artifacts/shared";
import {
  ArtifactForbiddenError,
  buildProjectUrl,
  buildWorkspaceProjectUrl,
  buildWorkspaceUrl,
  normalizeSlug,
  slugSchema
} from "@agent-artifacts/shared";
import type { ArtifactAccess } from "@agent-artifacts/access";
import type { WorkspaceAccess } from "@agent-artifacts/workspace";
import { z } from "zod";
import { getOwnerByUsername, getProjectIdByOwnerSlug } from "./drizzle-owner-lookup.js";

export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project was not found.");
    this.name = "ProjectNotFoundError";
  }
}

export const createProjectInputSchema = z.object({
  ownerUsername: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional()
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export interface ProjectRecord {
  id: string;
  ownerUserId: string;
  ownerUsername: string;
  workspaceId: string | null;
  slug: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSummary {
  projectId: string;
  ownerUserId: string;
  ownerUsername: string;
  normalizedSlug: string;
  title: string;
  url: string;
}

export interface ProjectRepository {
  getOwnerByUsername(username: string): Promise<{ userId: string; username: string } | undefined>;
  projectSlugExists(ownerUserId: string, normalizedSlug: string): Promise<boolean>;
  workspaceProjectSlugExists(workspaceId: string, normalizedSlug: string): Promise<boolean>;
  getProjectByOwnerSlug(username: string, projectSlug: string): Promise<ProjectRecord | undefined>;
  getProjectByWorkspaceSlug(workspaceId: string, projectSlug: string): Promise<ProjectRecord | undefined>;
  getProjectById(projectId: string): Promise<ProjectRecord | undefined>;
  createProject(input: PersistCreateProjectInput): Promise<void>;
  transferProjectToWorkspace(projectId: string, workspaceId: string): Promise<void>;
  listProjectsForOwner(ownerUserId: string): Promise<ProjectRecord[]>;
  listProjectsForWorkspace(workspaceId: string): Promise<ProjectRecord[]>;
  getPersonalWorkspaceId(userId: string): Promise<string | undefined>;
}

export interface PersistCreateProjectInput {
  id: string;
  ownerUserId: string;
  workspaceId?: string;
  slug: string;
  title: string;
  description?: string;
}

export class ProjectSlugUnavailableError extends Error {
  constructor(slug: string) {
    super(`Project slug "${slug}" is not available.`);
    this.name = "ProjectSlugUnavailableError";
  }
}

export function validateProjectSlug(slug: string): string {
  const normalized = normalizeSlug(slug);
  return slugSchema.parse(normalized);
}

export const createWorkspaceProjectInputSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional()
});

export type CreateWorkspaceProjectInput = z.infer<typeof createWorkspaceProjectInputSchema>;

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly appUrl: string,
    private readonly access: ArtifactAccess,
    private readonly workspaceAccess?: WorkspaceAccess
  ) {}

  private namespaceContext(project: Pick<ProjectRecord, "ownerUserId" | "workspaceId">) {
    return {
      kind: "namespace" as const,
      ownerUserId: project.ownerUserId,
      workspaceId: project.workspaceId ?? undefined
    };
  }

  async checkProjectSlugAvailability(
    ownerUsername: string,
    slug: string,
    principal: Principal
  ): Promise<{ available: boolean; ownerUserId: string; normalizedSlug: string }> {
    const normalizedSlug = validateProjectSlug(slug);
    const owner = await this.requireOwner(ownerUsername);
    const personalWorkspaceId = await this.repository.getPersonalWorkspaceId(owner.userId);
    await this.access.assertAuthorized({
      principal,
      action: "artifact.create",
      context: { kind: "namespace", ownerUserId: owner.userId, workspaceId: personalWorkspaceId }
    });
    const available = !(await this.repository.projectSlugExists(owner.userId, normalizedSlug));

    return { available, ownerUserId: owner.userId, normalizedSlug };
  }

  async checkWorkspaceProjectSlugAvailability(
    workspaceId: string,
    slug: string,
    principal: Principal
  ): Promise<{ available: boolean; normalizedSlug: string }> {
    await this.requireWorkspaceAccess(workspaceId, principal, "workspace.create_content");
    const normalizedSlug = validateProjectSlug(slug);
    const available = !(await this.repository.workspaceProjectSlugExists(workspaceId, normalizedSlug));
    return { available, normalizedSlug };
  }

  async createProject(input: CreateProjectInput, principal: Principal): Promise<ProjectSummary> {
    const parsed = createProjectInputSchema.parse(input);
    const owner = await this.requireOwner(parsed.ownerUsername);
    const personalWorkspaceId = await this.repository.getPersonalWorkspaceId(owner.userId);
    await this.access.assertAuthorized({
      principal,
      action: "artifact.create",
      context: { kind: "namespace", ownerUserId: owner.userId, workspaceId: personalWorkspaceId }
    });

    const normalizedSlug = validateProjectSlug(parsed.slug);
    const available = !(await this.repository.projectSlugExists(owner.userId, normalizedSlug));
    if (!available) {
      throw new ProjectSlugUnavailableError(normalizedSlug);
    }

    const projectId = randomUUID();
    await this.repository.createProject({
      id: projectId,
      ownerUserId: owner.userId,
      workspaceId: personalWorkspaceId,
      slug: normalizedSlug,
      title: parsed.title,
      description: parsed.description
    });

    return {
      projectId,
      ownerUserId: owner.userId,
      ownerUsername: owner.username,
      normalizedSlug,
      title: parsed.title,
      url: buildProjectUrl(this.appUrl, owner.username, normalizedSlug)
    };
  }

  async createWorkspaceProject(
    workspaceId: string,
    workspaceSlug: string,
    input: CreateWorkspaceProjectInput,
    principal: Principal
  ): Promise<ProjectSummary & { workspaceId: string; url: string }> {
    if (principal.type !== "user") {
      throw new ArtifactForbiddenError("Only signed-in users can create workspace projects.");
    }

    await this.requireWorkspaceAccess(workspaceId, principal, "workspace.create_content");
    const parsed = createWorkspaceProjectInputSchema.parse(input);
    const normalizedSlug = validateProjectSlug(parsed.slug);
    const available = !(await this.repository.workspaceProjectSlugExists(workspaceId, normalizedSlug));
    if (!available) {
      throw new ProjectSlugUnavailableError(normalizedSlug);
    }

    const projectId = randomUUID();
    await this.repository.createProject({
      id: projectId,
      ownerUserId: principal.id,
      workspaceId,
      slug: normalizedSlug,
      title: parsed.title,
      description: parsed.description
    });

    return {
      projectId,
      ownerUserId: principal.id,
      ownerUsername: workspaceSlug,
      normalizedSlug,
      title: parsed.title,
      workspaceId,
      url: `${buildWorkspaceUrl(this.appUrl, workspaceSlug)}/${normalizedSlug}`
    };
  }

  async transferProjectToWorkspace(
    projectId: string,
    workspaceId: string,
    workspaceSlug: string,
    principal: Principal
  ): Promise<ProjectSummary & { workspaceId: string }> {
    if (principal.type !== "user") {
      throw new ArtifactForbiddenError("Only signed-in users can transfer projects.");
    }

    const project = await this.repository.getProjectById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    await this.access.assertAuthorized({
      principal,
      action: "artifact.create",
      context: this.namespaceContext(project)
    });
    await this.requireWorkspaceAccess(workspaceId, principal, "workspace.create_content");

    const slugTaken = await this.repository.workspaceProjectSlugExists(workspaceId, project.slug);
    if (slugTaken && project.workspaceId !== workspaceId) {
      throw new ProjectSlugUnavailableError(project.slug);
    }

    await this.repository.transferProjectToWorkspace(project.id, workspaceId);

    return {
      projectId: project.id,
      ownerUserId: project.ownerUserId,
      ownerUsername: workspaceSlug,
      normalizedSlug: project.slug,
      title: project.title,
      workspaceId,
      url: buildWorkspaceProjectUrl(this.appUrl, workspaceSlug, project.slug)
    };
  }

  async getProjectByPath(username: string, projectSlug: string, principal: Principal): Promise<ProjectRecord> {
    const project = await this.repository.getProjectByOwnerSlug(username, validateProjectSlug(projectSlug));
    if (!project) {
      throw new ProjectNotFoundError();
    }

    await this.access.assertAuthorized({
      principal,
      action: "project.view",
      context: this.namespaceContext(project)
    });

    return project;
  }

  async getWorkspaceProjectByPath(
    workspaceId: string,
    projectSlug: string,
    principal: Principal
  ): Promise<ProjectRecord> {
    const project = await this.repository.getProjectByWorkspaceSlug(workspaceId, validateProjectSlug(projectSlug));
    if (!project) {
      throw new ProjectNotFoundError();
    }

    await this.access.assertAuthorized({
      principal,
      action: "project.view",
      context: this.namespaceContext(project)
    });

    return project;
  }

  async getProjectByPathRaw(username: string, projectSlug: string): Promise<ProjectRecord> {
    const project = await this.repository.getProjectByOwnerSlug(username, validateProjectSlug(projectSlug));
    if (!project) {
      throw new ProjectNotFoundError();
    }

    return project;
  }

  async getWorkspaceProjectByPathRaw(workspaceId: string, projectSlug: string): Promise<ProjectRecord> {
    const project = await this.repository.getProjectByWorkspaceSlug(workspaceId, validateProjectSlug(projectSlug));
    if (!project) {
      throw new ProjectNotFoundError();
    }

    return project;
  }

  async listOwnedProjects(principal: Principal): Promise<ProjectRecord[]> {
    if (principal.type !== "user") {
      throw new ArtifactForbiddenError("Only signed-in users can list owned projects.");
    }

    return this.repository.listProjectsForOwner(principal.id);
  }

  async listWorkspaceProjects(workspaceId: string, principal: Principal): Promise<ProjectRecord[]> {
    await this.requireWorkspaceAccess(workspaceId, principal, "workspace.view");
    return this.repository.listProjectsForWorkspace(workspaceId);
  }

  private async requireWorkspaceAccess(
    workspaceId: string,
    principal: Principal,
    action: "workspace.view" | "workspace.create_content"
  ): Promise<void> {
    if (!this.workspaceAccess) {
      throw new ArtifactForbiddenError("Workspace access is not configured.");
    }

    await this.workspaceAccess.assertAuthorized({
      principal,
      action,
      context: { workspaceId }
    });
  }

  private async requireOwner(ownerUsername: string): Promise<{ userId: string; username: string }> {
    const owner = await this.repository.getOwnerByUsername(ownerUsername);
    if (!owner) {
      throw new ProjectNotFoundError();
    }

    return owner;
  }
}

export class DrizzleProjectRepository implements ProjectRepository {
  constructor(private readonly db: Database) {}

  async getOwnerByUsername(username: string): Promise<{ userId: string; username: string } | undefined> {
    return getOwnerByUsername(this.db, username);
  }

  async projectSlugExists(ownerUserId: string, normalizedSlug: string): Promise<boolean> {
    const [project] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.ownerUserId, ownerUserId), sql`lower(${projects.slug}) = ${normalizedSlug}`))
      .limit(1);

    return project !== undefined;
  }

  async workspaceProjectSlugExists(workspaceId: string, normalizedSlug: string): Promise<boolean> {
    const [project] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), sql`lower(${projects.slug}) = ${normalizedSlug}`))
      .limit(1);

    return project !== undefined;
  }

  async getProjectByWorkspaceSlug(workspaceId: string, projectSlug: string): Promise<ProjectRecord | undefined> {
    const [project] = await this.projectQuery()
      .where(and(eq(projects.workspaceId, workspaceId), sql`lower(${projects.slug}) = ${projectSlug}`))
      .limit(1);

    return project;
  }

  async getProjectById(projectId: string): Promise<ProjectRecord | undefined> {
    const [project] = await this.projectQuery().where(eq(projects.id, projectId)).limit(1);
    return project;
  }

  async getPersonalWorkspaceId(userId: string): Promise<string | undefined> {
    const [workspace] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.personalUserId, userId))
      .limit(1);

    return workspace?.id;
  }

  async getProjectByOwnerSlug(username: string, projectSlug: string): Promise<ProjectRecord | undefined> {
    const match = await getProjectIdByOwnerSlug(this.db, username, projectSlug);
    if (!match) {
      return undefined;
    }

    const [project] = await this.projectQuery().where(eq(projects.id, match.id)).limit(1);
    return project;
  }

  async createProject(input: PersistCreateProjectInput): Promise<void> {
    const now = new Date();
    await this.db.insert(projects).values({
      id: input.id,
      ownerUserId: input.ownerUserId,
      workspaceId: input.workspaceId ?? null,
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now
    });
  }

  async transferProjectToWorkspace(projectId: string, workspaceId: string): Promise<void> {
    await this.db
      .update(projects)
      .set({ workspaceId, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  }

  async listProjectsForOwner(ownerUserId: string): Promise<ProjectRecord[]> {
    return this.projectQuery()
      .where(eq(projects.ownerUserId, ownerUserId))
      .orderBy(desc(projects.updatedAt));
  }

  async listProjectsForWorkspace(workspaceId: string): Promise<ProjectRecord[]> {
    return this.projectQuery()
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(desc(projects.updatedAt));
  }

  private projectQuery() {
    return this.db
      .select({
        id: projects.id,
        ownerUserId: projects.ownerUserId,
        ownerUsername: userProfiles.username,
        workspaceId: projects.workspaceId,
        slug: projects.slug,
        title: projects.title,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt
      })
      .from(projects)
      .innerJoin(userProfiles, eq(userProfiles.userId, projects.ownerUserId));
  }
}
