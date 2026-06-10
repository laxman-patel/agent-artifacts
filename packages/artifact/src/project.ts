import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { BillingService } from "@agent-artifacts/billing";
import type { Database } from "@agent-artifacts/db";
import { projects, workspaceMembers, workspaces } from "@agent-artifacts/db";
import type { Principal, WorkspaceKind, WorkspaceRole } from "@agent-artifacts/shared";
import { ArtifactForbiddenError, buildWorkspaceProjectUrl, normalizeSlug, slugSchema } from "@agent-artifacts/shared";
import type { ArtifactAccess } from "@agent-artifacts/access";
import { z } from "zod";

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

export const createWorkspaceProjectInputSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional()
});

export type CreateWorkspaceProjectInput = z.infer<typeof createWorkspaceProjectInputSchema>;

export interface ProjectRecord {
  id: string;
  ownerUserId: string;
  ownerUsername: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  workspaceKind: WorkspaceKind;
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
  workspaceId: string;
  workspaceSlug: string;
  normalizedSlug: string;
  title: string;
  url: string;
}

export interface ProjectWorkspaceRecord {
  id: string;
  slug: string;
  name: string;
  kind: WorkspaceKind;
  createdByUserId: string | null;
  personalUserId: string | null;
}

export interface ProjectRepository {
  getWorkspaceBySlug(slug: string): Promise<ProjectWorkspaceRecord | undefined>;
  getWorkspaceById(workspaceId: string): Promise<ProjectWorkspaceRecord | undefined>;
  projectSlugExists(workspaceId: string, normalizedSlug: string): Promise<boolean>;
  getProjectByWorkspaceSlug(workspaceSlug: string, projectSlug: string): Promise<ProjectRecord | undefined>;
  getProjectByWorkspaceIdSlug(workspaceId: string, projectSlug: string): Promise<ProjectRecord | undefined>;
  createProject(input: PersistCreateProjectInput): Promise<void>;
  listProjectsForWorkspace(workspaceId: string): Promise<ProjectRecord[]>;
  listProjectsForUserMemberships(userId: string): Promise<ProjectRecord[]>;
}

export interface PersistCreateProjectInput {
  id: string;
  ownerUserId: string;
  workspaceId: string;
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

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly appUrl: string,
    private readonly access: ArtifactAccess,
    private readonly billing?: Pick<BillingService, "assertCanCreateProject">
  ) {}

  async checkProjectSlugAvailability(
    ownerUsername: string,
    slug: string,
    principal: Principal
  ): Promise<{ available: boolean; ownerUserId: string; workspaceId: string; normalizedSlug: string }> {
    const normalizedSlug = validateProjectSlug(slug);
    const workspace = await this.requireWorkspaceBySlug(ownerUsername);
    await this.assertCreateAccess(workspace, principal);
    const available = !(await this.repository.projectSlugExists(workspace.id, normalizedSlug));

    return { available, ownerUserId: this.namespaceOwnerUserId(workspace), workspaceId: workspace.id, normalizedSlug };
  }

  async checkWorkspaceProjectSlugAvailability(
    workspaceId: string,
    slug: string,
    principal: Principal
  ): Promise<{ available: boolean; normalizedSlug: string }> {
    const workspace = await this.requireWorkspaceById(workspaceId);
    await this.assertCreateAccess(workspace, principal);
    const normalizedSlug = validateProjectSlug(slug);
    const available = !(await this.repository.projectSlugExists(workspace.id, normalizedSlug));
    return { available, normalizedSlug };
  }

  async createProject(input: CreateProjectInput, principal: Principal): Promise<ProjectSummary> {
    const parsed = createProjectInputSchema.parse(input);
    const workspace = await this.requireWorkspaceBySlug(parsed.ownerUsername);
    await this.assertCreateAccess(workspace, principal);
    return this.createProjectInWorkspace(workspace, parsed, principal);
  }

  async createWorkspaceProject(
    workspaceId: string,
    _workspaceSlug: string,
    input: CreateWorkspaceProjectInput,
    principal: Principal
  ): Promise<ProjectSummary & { workspaceId: string; url: string }> {
    const workspace = await this.requireWorkspaceById(workspaceId);
    await this.assertCreateAccess(workspace, principal);
    const project = await this.createProjectInWorkspace(workspace, createWorkspaceProjectInputSchema.parse(input), principal);
    return { ...project, workspaceId: workspace.id };
  }

  async getProjectByPath(workspaceSlug: string, projectSlug: string, principal: Principal): Promise<ProjectRecord> {
    const project = await this.repository.getProjectByWorkspaceSlug(workspaceSlug, validateProjectSlug(projectSlug));
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
    const project = await this.repository.getProjectByWorkspaceIdSlug(workspaceId, validateProjectSlug(projectSlug));
    if (!project) {
      throw new ProjectNotFoundError();
    }

    await this.access.assertAuthorized({ principal, action: "project.view", context: this.namespaceContext(project) });
    return project;
  }

  async getProjectByPathRaw(workspaceSlug: string, projectSlug: string): Promise<ProjectRecord> {
    const project = await this.repository.getProjectByWorkspaceSlug(workspaceSlug, validateProjectSlug(projectSlug));
    if (!project) {
      throw new ProjectNotFoundError();
    }

    return project;
  }

  async getWorkspaceProjectByPathRaw(workspaceId: string, projectSlug: string): Promise<ProjectRecord> {
    const project = await this.repository.getProjectByWorkspaceIdSlug(workspaceId, validateProjectSlug(projectSlug));
    if (!project) {
      throw new ProjectNotFoundError();
    }

    return project;
  }

  async listOwnedProjects(principal: Principal): Promise<ProjectRecord[]> {
    if (principal.type !== "user") {
      throw new ArtifactForbiddenError("Only signed-in users can list workspace projects.");
    }

    return this.repository.listProjectsForUserMemberships(principal.id);
  }

  async listWorkspaceProjects(workspaceId: string, principal: Principal): Promise<ProjectRecord[]> {
    const workspace = await this.requireWorkspaceById(workspaceId);
    await this.access.assertAuthorized({
      principal,
      action: "project.view",
      context: { kind: "namespace", ownerUserId: this.namespaceOwnerUserId(workspace), workspaceId: workspace.id }
    });
    return this.repository.listProjectsForWorkspace(workspaceId);
  }

  async listPublicProjectsByWorkspaceSlug(workspaceSlug: string): Promise<ProjectRecord[]> {
    const workspace = await this.requireWorkspaceBySlug(workspaceSlug);
    return this.repository.listProjectsForWorkspace(workspace.id);
  }

  private async createProjectInWorkspace(
    workspace: ProjectWorkspaceRecord,
    input: CreateWorkspaceProjectInput,
    principal: Principal
  ): Promise<ProjectSummary> {
    if (principal.type !== "user") {
      throw new ArtifactForbiddenError("Only signed-in users can create projects.");
    }

    const normalizedSlug = validateProjectSlug(input.slug);
    const available = !(await this.repository.projectSlugExists(workspace.id, normalizedSlug));
    if (!available) {
      throw new ProjectSlugUnavailableError(normalizedSlug);
    }
    const ownerUserId = this.namespaceOwnerUserId(workspace);
    await this.billing?.assertCanCreateProject(ownerUserId);

    const projectId = randomUUID();
    await this.repository.createProject({
      id: projectId,
      ownerUserId,
      workspaceId: workspace.id,
      slug: normalizedSlug,
      title: input.title,
      description: input.description
    });

    return {
      projectId,
      ownerUserId,
      ownerUsername: workspace.slug,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      normalizedSlug,
      title: input.title,
      url: buildWorkspaceProjectUrl(this.appUrl, workspace.slug, normalizedSlug)
    };
  }

  private namespaceContext(project: Pick<ProjectRecord, "ownerUserId" | "workspaceId">) {
    return { kind: "namespace" as const, ownerUserId: project.ownerUserId, workspaceId: project.workspaceId };
  }

  private async assertCreateAccess(workspace: ProjectWorkspaceRecord, principal: Principal): Promise<void> {
    await this.access.assertAuthorized({
      principal,
      action: "artifact.create",
      context: { kind: "namespace", ownerUserId: this.namespaceOwnerUserId(workspace), workspaceId: workspace.id }
    });
  }

  private namespaceOwnerUserId(workspace: ProjectWorkspaceRecord): string {
    return workspace.personalUserId ?? workspace.createdByUserId ?? workspace.id;
  }

  private async requireWorkspaceBySlug(slug: string): Promise<ProjectWorkspaceRecord> {
    const workspace = await this.repository.getWorkspaceBySlug(slug.trim().toLowerCase());
    if (!workspace) {
      throw new ProjectNotFoundError();
    }
    return workspace;
  }

  private async requireWorkspaceById(workspaceId: string): Promise<ProjectWorkspaceRecord> {
    const workspace = await this.repository.getWorkspaceById(workspaceId);
    if (!workspace) {
      throw new ProjectNotFoundError();
    }
    return workspace;
  }
}

export class DrizzleProjectRepository implements ProjectRepository {
  constructor(private readonly db: Database) {}

  async getWorkspaceBySlug(slug: string): Promise<ProjectWorkspaceRecord | undefined> {
    const [workspace] = await this.db
      .select({
        id: workspaces.id,
        slug: workspaces.slug,
        name: workspaces.name,
        kind: workspaces.kind,
        createdByUserId: workspaces.createdByUserId,
        personalUserId: workspaces.personalUserId
      })
      .from(workspaces)
      .where(and(sql`lower(${workspaces.slug}) = ${slug.trim().toLowerCase()}`, eq(workspaces.state, "active")))
      .limit(1);

    return workspace;
  }

  async getWorkspaceById(workspaceId: string): Promise<ProjectWorkspaceRecord | undefined> {
    const [workspace] = await this.db
      .select({
        id: workspaces.id,
        slug: workspaces.slug,
        name: workspaces.name,
        kind: workspaces.kind,
        createdByUserId: workspaces.createdByUserId,
        personalUserId: workspaces.personalUserId
      })
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.state, "active")))
      .limit(1);

    return workspace;
  }

  async projectSlugExists(workspaceId: string, normalizedSlug: string): Promise<boolean> {
    const [project] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), sql`lower(${projects.slug}) = ${normalizedSlug}`))
      .limit(1);

    return project !== undefined;
  }

  async getProjectByWorkspaceSlug(workspaceSlug: string, projectSlug: string): Promise<ProjectRecord | undefined> {
    const [project] = await this.projectQuery()
      .where(
        and(
          sql`lower(${workspaces.slug}) = ${workspaceSlug.trim().toLowerCase()}`,
          sql`lower(${projects.slug}) = ${validateProjectSlug(projectSlug)}`,
          eq(workspaces.state, "active")
        )
      )
      .limit(1);
    return project;
  }

  async getProjectByWorkspaceIdSlug(workspaceId: string, projectSlug: string): Promise<ProjectRecord | undefined> {
    const [project] = await this.projectQuery()
      .where(and(eq(projects.workspaceId, workspaceId), sql`lower(${projects.slug}) = ${validateProjectSlug(projectSlug)}`))
      .limit(1);

    return project;
  }

  async createProject(input: PersistCreateProjectInput): Promise<void> {
    const now = new Date();
    await this.db.insert(projects).values({
      id: input.id,
      ownerUserId: input.ownerUserId,
      workspaceId: input.workspaceId,
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now
    });
  }

  async listProjectsForWorkspace(workspaceId: string): Promise<ProjectRecord[]> {
    return this.projectQuery()
      .where(and(eq(projects.workspaceId, workspaceId), eq(workspaces.state, "active")))
      .orderBy(desc(projects.updatedAt));
  }

  async listProjectsForUserMemberships(userId: string): Promise<ProjectRecord[]> {
    return this.projectQuery()
      .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, projects.workspaceId))
      .where(and(eq(workspaceMembers.userId, userId), eq(workspaces.state, "active")))
      .orderBy(desc(projects.updatedAt));
  }

  private projectQuery() {
    return this.db
      .select({
        id: projects.id,
        ownerUserId: projects.ownerUserId,
        ownerUsername: workspaces.slug,
        workspaceId: projects.workspaceId,
        workspaceSlug: workspaces.slug,
        workspaceName: workspaces.name,
        workspaceKind: workspaces.kind,
        slug: projects.slug,
        title: projects.title,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt
      })
      .from(projects)
      .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId));
  }
}
