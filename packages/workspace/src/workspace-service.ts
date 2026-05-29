import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Database, DbExecutor } from "@agent-artifacts/db";
import { users, userProfiles, workspaceMembers, workspaces } from "@agent-artifacts/db";
import type {
  Principal,
  WorkspaceKind,
  WorkspaceRole
} from "@agent-artifacts/shared";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
  WorkspaceSlugUnavailableError,
  workspaceSlugSchema
} from "@agent-artifacts/shared";
import { z } from "zod";
import type { WorkspaceAccess } from "./access.js";
import type { WorkspaceRoleResolver } from "./access.js";
import { createWorkspaceAccess } from "./access.js";

export interface WorkspaceRecord {
  id: string;
  slug: string;
  name: string;
  kind: WorkspaceKind;
  personalUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMemberRecord {
  id: string;
  workspaceId: string;
  userId: string;
  email?: string | null;
  name?: string | null;
  displayName?: string | null;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceRepository {
  slugExists(normalizedSlug: string): Promise<boolean>;
  usernameExists(normalizedSlug: string): Promise<boolean>;
  getById(workspaceId: string): Promise<WorkspaceRecord | undefined>;
  getBySlug(slug: string): Promise<WorkspaceRecord | undefined>;
  getPersonalWorkspaceForUser(userId: string): Promise<WorkspaceRecord | undefined>;
  createWorkspace(input: PersistCreateWorkspaceInput): Promise<void>;
  addMember(input: PersistAddMemberInput): Promise<void>;
  listMembershipsForUser(userId: string): Promise<Array<WorkspaceRecord & { role: WorkspaceRole }>>;
  listMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]>;
  getMembership(workspaceId: string, userId: string): Promise<WorkspaceMemberRecord | undefined>;
  updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
}

export interface PersistCreateWorkspaceInput {
  id: string;
  slug: string;
  name: string;
  kind: WorkspaceKind;
  createdByUserId: string;
  personalUserId?: string;
}

export interface PersistAddMemberInput {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export const createTeamWorkspaceInputSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1).max(200)
});

export type CreateTeamWorkspaceInput = z.infer<typeof createTeamWorkspaceInputSchema>;

export function validateWorkspaceSlug(slug: string): string {
  return workspaceSlugSchema.parse(slug.trim().toLowerCase());
}

export class WorkspaceService {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly access: WorkspaceAccess
  ) {}

  async checkSlugAvailability(slug: string): Promise<{ available: boolean; normalizedSlug: string }> {
    const normalizedSlug = validateWorkspaceSlug(slug);
    const slugTaken = await this.repository.slugExists(normalizedSlug);
    const usernameTaken = await this.repository.usernameExists(normalizedSlug);

    return {
      available: !slugTaken && !usernameTaken,
      normalizedSlug
    };
  }

  async createTeamWorkspace(
    input: CreateTeamWorkspaceInput,
    principal: Principal
  ): Promise<WorkspaceRecord & { role: WorkspaceRole }> {
    if (principal.type !== "user") {
      throw new WorkspaceForbiddenError("Only signed-in users can create workspaces.");
    }

    const parsed = createTeamWorkspaceInputSchema.parse(input);
    const normalizedSlug = validateWorkspaceSlug(parsed.slug);
    const availability = await this.checkSlugAvailability(normalizedSlug);

    if (!availability.available) {
      throw new WorkspaceSlugUnavailableError(normalizedSlug);
    }

    const workspaceId = randomUUID();
    const memberId = randomUUID();
    const now = new Date();

    await this.repository.createWorkspace({
      id: workspaceId,
      slug: normalizedSlug,
      name: parsed.name,
      kind: "team",
      createdByUserId: principal.id
    });

    await this.repository.addMember({
      id: memberId,
      workspaceId,
      userId: principal.id,
      role: "owner"
    });

    const workspace = await this.repository.getById(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError();
    }

    return { ...workspace, role: "owner" as const, createdAt: now, updatedAt: now };
  }

  async getWorkspace(workspaceId: string, principal: Principal): Promise<WorkspaceRecord> {
    const workspace = await this.repository.getById(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError();
    }

    await this.access.assertAuthorized({
      principal,
      action: "workspace.view",
      context: { workspaceId }
    });

    return workspace;
  }

  async getWorkspaceBySlug(slug: string, principal: Principal): Promise<WorkspaceRecord> {
    const workspace = await this.repository.getBySlug(validateWorkspaceSlug(slug));
    if (!workspace) {
      throw new WorkspaceNotFoundError();
    }

    return this.getWorkspace(workspace.id, principal);
  }

  async getPublicWorkspaceBySlug(slug: string): Promise<WorkspaceRecord> {
    const workspace = await this.repository.getBySlug(validateWorkspaceSlug(slug));
    if (!workspace) {
      throw new WorkspaceNotFoundError();
    }

    return workspace;
  }

  async listWorkspacesForUser(principal: Principal): Promise<Array<WorkspaceRecord & { role: WorkspaceRole }>> {
    if (principal.type !== "user") {
      throw new WorkspaceForbiddenError("Only signed-in users can list workspaces.");
    }

    return this.repository.listMembershipsForUser(principal.id);
  }

  async listMembers(workspaceId: string, principal: Principal): Promise<WorkspaceMemberRecord[]> {
    await this.access.assertAuthorized({
      principal,
      action: "workspace.manage_members",
      context: { workspaceId }
    });

    return this.repository.listMembers(workspaceId);
  }
}

export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: DbExecutor) {}

  async slugExists(normalizedSlug: string): Promise<boolean> {
    const [workspace] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(sql`lower(${workspaces.slug}) = ${normalizedSlug}`)
      .limit(1);

    return workspace !== undefined;
  }

  async usernameExists(normalizedSlug: string): Promise<boolean> {
    const [profile] = await this.db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(sql`lower(${userProfiles.username}) = ${normalizedSlug}`)
      .limit(1);

    return profile !== undefined;
  }

  async getById(workspaceId: string): Promise<WorkspaceRecord | undefined> {
    const [workspace] = await this.db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    return workspace ? this.toRecord(workspace) : undefined;
  }

  async getBySlug(slug: string): Promise<WorkspaceRecord | undefined> {
    const [workspace] = await this.db
      .select()
      .from(workspaces)
      .where(sql`lower(${workspaces.slug}) = ${slug}`)
      .limit(1);

    return workspace ? this.toRecord(workspace) : undefined;
  }

  async getPersonalWorkspaceForUser(userId: string): Promise<WorkspaceRecord | undefined> {
    const [workspace] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.personalUserId, userId))
      .limit(1);

    return workspace ? this.toRecord(workspace) : undefined;
  }

  async createWorkspace(input: PersistCreateWorkspaceInput): Promise<void> {
    const now = new Date();
    await this.db.insert(workspaces).values({
      id: input.id,
      slug: input.slug,
      name: input.name,
      kind: input.kind,
      state: "active",
      createdByUserId: input.createdByUserId,
      personalUserId: input.personalUserId ?? null,
      createdAt: now,
      updatedAt: now
    });
  }

  async addMember(input: PersistAddMemberInput): Promise<void> {
    const now = new Date();
    await this.db.insert(workspaceMembers).values({
      id: input.id,
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: input.role,
      createdAt: now,
      updatedAt: now
    });
  }

  async listMembershipsForUser(userId: string): Promise<Array<WorkspaceRecord & { role: WorkspaceRole }>> {
    const rows = await this.db
      .select({
        id: workspaces.id,
        slug: workspaces.slug,
        name: workspaces.name,
        kind: workspaces.kind,
        personalUserId: workspaces.personalUserId,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
        role: workspaceMembers.role
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(and(eq(workspaceMembers.userId, userId), eq(workspaces.state, "active")));

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      personalUserId: row.personalUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      role: row.role
    }));
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]> {
    return this.db
      .select({
        id: workspaceMembers.id,
        workspaceId: workspaceMembers.workspaceId,
        userId: workspaceMembers.userId,
        email: users.email,
        name: users.name,
        displayName: userProfiles.displayName,
        role: workspaceMembers.role,
        createdAt: workspaceMembers.createdAt,
        updatedAt: workspaceMembers.updatedAt
      })
      .from(workspaceMembers)
      .leftJoin(users, eq(users.id, workspaceMembers.userId))
      .leftJoin(userProfiles, eq(userProfiles.userId, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId));
  }

  async getMembership(workspaceId: string, userId: string): Promise<WorkspaceMemberRecord | undefined> {
    const [member] = await this.db
      .select({
        id: workspaceMembers.id,
        workspaceId: workspaceMembers.workspaceId,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        createdAt: workspaceMembers.createdAt,
        updatedAt: workspaceMembers.updatedAt
      })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);

    return member;
  }

  async updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void> {
    await this.db
      .update(workspaceMembers)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await this.db
      .delete(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
  }

  private toRecord(workspace: typeof workspaces.$inferSelect): WorkspaceRecord {
    return {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      kind: workspace.kind,
      personalUserId: workspace.personalUserId,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt
    };
  }
}

export class DrizzleWorkspaceRoleResolver implements WorkspaceRoleResolver {
  constructor(private readonly repository: WorkspaceRepository) {}

  async resolveMembership(
    principal: Principal,
    workspaceId: string
  ): Promise<{ role: WorkspaceRole | undefined }> {
    if (principal.type !== "user") {
      return { role: undefined };
    }

    const membership = await this.repository.getMembership(workspaceId, principal.id);
    return { role: membership?.role };
  }
}

export function createDrizzleWorkspaceService(db: Database): WorkspaceService {
  const repository = new DrizzleWorkspaceRepository(db);
  const access = createWorkspaceAccess(new DrizzleWorkspaceRoleResolver(repository));
  return new WorkspaceService(repository, access);
}

export async function ensurePersonalWorkspace(
  db: DbExecutor,
  input: { userId: string; username: string; displayName?: string | null }
): Promise<string> {
  const repository = new DrizzleWorkspaceRepository(db);
  const existing = await repository.getPersonalWorkspaceForUser(input.userId);
  if (existing) {
    return existing.id;
  }

  const workspaceId = `ws_personal_${input.userId}`;
  const memberId = `wsm_${input.userId}`;

  await repository.createWorkspace({
    id: workspaceId,
    slug: input.username,
    name: input.displayName ?? input.username,
    kind: "personal",
    createdByUserId: input.userId,
    personalUserId: input.userId
  });

  await repository.addMember({
    id: memberId,
    workspaceId,
    userId: input.userId,
    role: "owner"
  });

  return workspaceId;
}
