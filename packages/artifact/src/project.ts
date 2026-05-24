import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { projects, userProfiles } from "@agent-artifacts/db";
import type { Principal } from "@agent-artifacts/shared";
import { ArtifactForbiddenError, buildProjectUrl, normalizeSlug, slugSchema } from "@agent-artifacts/shared";
import type { ArtifactAccess } from "@agent-artifacts/access";
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
  getProjectByOwnerSlug(username: string, projectSlug: string): Promise<ProjectRecord | undefined>;
  createProject(input: PersistCreateProjectInput): Promise<void>;
  listProjectsForOwner(ownerUserId: string): Promise<ProjectRecord[]>;
}

export interface PersistCreateProjectInput {
  id: string;
  ownerUserId: string;
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
    private readonly access: ArtifactAccess
  ) {}

  async checkProjectSlugAvailability(
    ownerUsername: string,
    slug: string,
    principal: Principal
  ): Promise<{ available: boolean; ownerUserId: string; normalizedSlug: string }> {
    const normalizedSlug = validateProjectSlug(slug);
    const owner = await this.requireOwner(ownerUsername);
    await this.access.assertAuthorized({
      principal,
      action: "artifact.create",
      context: { kind: "namespace", ownerUserId: owner.userId }
    });
    const available = !(await this.repository.projectSlugExists(owner.userId, normalizedSlug));

    return { available, ownerUserId: owner.userId, normalizedSlug };
  }

  async createProject(input: CreateProjectInput, principal: Principal): Promise<ProjectSummary> {
    const parsed = createProjectInputSchema.parse(input);
    const owner = await this.requireOwner(parsed.ownerUsername);
    await this.access.assertAuthorized({
      principal,
      action: "artifact.create",
      context: { kind: "namespace", ownerUserId: owner.userId }
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

  async getProjectByPath(username: string, projectSlug: string, principal: Principal): Promise<ProjectRecord> {
    const project = await this.repository.getProjectByOwnerSlug(username, validateProjectSlug(projectSlug));
    if (!project) {
      throw new ProjectNotFoundError();
    }

    await this.access.assertAuthorized({
      principal,
      action: "project.view",
      context: { kind: "namespace", ownerUserId: project.ownerUserId }
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

  async listOwnedProjects(principal: Principal): Promise<ProjectRecord[]> {
    if (principal.type !== "user") {
      throw new ArtifactForbiddenError("Only signed-in users can list owned projects.");
    }

    return this.repository.listProjectsForOwner(principal.id);
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
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now
    });
  }

  async listProjectsForOwner(ownerUserId: string): Promise<ProjectRecord[]> {
    return this.projectQuery()
      .where(eq(projects.ownerUserId, ownerUserId))
      .orderBy(desc(projects.updatedAt));
  }

  private projectQuery() {
    return this.db
      .select({
        id: projects.id,
        ownerUserId: projects.ownerUserId,
        ownerUsername: userProfiles.username,
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
