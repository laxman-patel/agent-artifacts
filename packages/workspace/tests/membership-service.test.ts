import { describe, expect, it } from "vitest";
import type { Principal, WorkspaceRole } from "@agent-artifacts/shared";
import { WorkspaceForbiddenError } from "@agent-artifacts/shared";
import { MemoryWorkspaceRoleResolver, createWorkspaceAccess } from "../src/access.js";
import {
  MembershipService,
  WorkspaceMemberConflictError,
  WorkspaceMemberNotFoundError
} from "../src/membership-service.js";
import type {
  PersistAddMemberInput,
  PersistCreateWorkspaceInput,
  WorkspaceMemberRecord,
  WorkspaceRecord,
  WorkspaceRepository
} from "../src/workspace-service.js";

class MemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly workspaces = new Map<string, WorkspaceRecord>();
  private readonly members = new Map<string, WorkspaceMemberRecord>();
  deferListMembers = false;
  private readonly releaseListMemberFns: Array<() => void> = [];
  private listMembersWaiter: (() => void) | undefined;

  memberKey(workspaceId: string, userId: string): string {
    return `${workspaceId}:${userId}`;
  }

  addWorkspace(workspace: WorkspaceRecord): void {
    this.workspaces.set(workspace.id, workspace);
  }

  addMemberRecord(member: WorkspaceMemberRecord): void {
    this.members.set(this.memberKey(member.workspaceId, member.userId), member);
  }

  async slugExists(): Promise<boolean> {
    return false;
  }

  async usernameExists(): Promise<boolean> {
    return false;
  }

  async getById(workspaceId: string): Promise<WorkspaceRecord | undefined> {
    return this.workspaces.get(workspaceId);
  }

  async getBySlug(): Promise<WorkspaceRecord | undefined> {
    return undefined;
  }

  async getPersonalWorkspaceForUser(): Promise<WorkspaceRecord | undefined> {
    return undefined;
  }

  async createWorkspace(input: PersistCreateWorkspaceInput): Promise<void> {
    const now = new Date();
    this.workspaces.set(input.id, {
      id: input.id,
      slug: input.slug,
      name: input.name,
      kind: input.kind,
      personalUserId: input.personalUserId ?? null,
      createdAt: now,
      updatedAt: now
    });
  }

  async createWorkspaceWithOwner(workspace: PersistCreateWorkspaceInput, member: PersistAddMemberInput): Promise<void> {
    await this.createWorkspace(workspace);
    await this.addMember(member);
  }

  async addMember(input: PersistAddMemberInput): Promise<void> {
    const now = new Date();
    this.members.set(this.memberKey(input.workspaceId, input.userId), {
      id: input.id,
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: input.role,
      createdAt: now,
      updatedAt: now
    });
  }

  async listMembershipsForUser(): Promise<Array<WorkspaceRecord & { role: WorkspaceRole }>> {
    return [];
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]> {
    const members = [...this.members.values()].filter((member) => member.workspaceId === workspaceId);
    if (this.deferListMembers) {
      await new Promise<void>((resolve) => {
        this.releaseListMemberFns.push(resolve);
        this.listMembersWaiter?.();
      });
    }
    return members;
  }

  async getMembership(workspaceId: string, userId: string): Promise<WorkspaceMemberRecord | undefined> {
    return this.members.get(this.memberKey(workspaceId, userId));
  }

  async updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<boolean> {
    const member = this.members.get(this.memberKey(workspaceId, userId));
    if (!member) {
      throw new WorkspaceMemberNotFoundError();
    }

    if (member.role === "owner" && role !== "owner" && !this.hasOtherOwner(workspaceId, userId)) {
      return false;
    }

    this.members.set(this.memberKey(workspaceId, userId), {
      ...member,
      role,
      updatedAt: new Date()
    });
    return true;
  }

  async removeMember(workspaceId: string, userId: string): Promise<boolean> {
    const member = this.members.get(this.memberKey(workspaceId, userId));
    if (!member) {
      return false;
    }
    if (member.role === "owner" && !this.hasOtherOwner(workspaceId, userId)) {
      return false;
    }

    this.members.delete(this.memberKey(workspaceId, userId));
    return true;
  }

  async waitForListMembers(count: number): Promise<void> {
    while (this.releaseListMemberFns.length < count) {
      await new Promise<void>((resolve) => {
        this.listMembersWaiter = resolve;
      });
      this.listMembersWaiter = undefined;
    }
  }

  releaseListMembers(): void {
    this.deferListMembers = false;
    for (const release of this.releaseListMemberFns.splice(0)) {
      release();
    }
  }

  private hasOtherOwner(workspaceId: string, userId: string): boolean {
    return [...this.members.values()].some(
      (member) => member.workspaceId === workspaceId && member.userId !== userId && member.role === "owner"
    );
  }
}

const workspaceId = "ws_team_1";

const owner: Principal = {
  type: "user",
  id: "user_owner",
  ownerUserId: "user_owner",
  email: "owner@example.com",
  scopes: []
};

const admin: Principal = {
  type: "user",
  id: "user_admin",
  ownerUserId: "user_admin",
  email: "admin@example.com",
  scopes: []
};

const member: Principal = {
  type: "user",
  id: "user_member",
  ownerUserId: "user_member",
  email: "member@example.com",
  scopes: []
};

const intruder: Principal = {
  type: "user",
  id: "user_other",
  ownerUserId: "user_other",
  email: "other@example.com",
  scopes: []
};

function createHarness(options?: { withCoOwner?: boolean }) {
  const workspaceRepository = new MemoryWorkspaceRepository();
  const auditEvents: Array<Record<string, unknown>> = [];
  workspaceRepository.addWorkspace({
    id: workspaceId,
    slug: "acme",
    name: "Acme",
    kind: "team",
    personalUserId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  workspaceRepository.addMemberRecord({
    id: "wsm_owner",
    workspaceId,
    userId: owner.id,
    role: "owner",
    createdAt: new Date(),
    updatedAt: new Date()
  });

  workspaceRepository.addMemberRecord({
    id: "wsm_admin",
    workspaceId,
    userId: admin.id,
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date()
  });

  workspaceRepository.addMemberRecord({
    id: "wsm_member",
    workspaceId,
    userId: member.id,
    role: "member",
    createdAt: new Date(),
    updatedAt: new Date()
  });

  if (options?.withCoOwner) {
    workspaceRepository.addMemberRecord({
      id: "wsm_co_owner",
      workspaceId,
      userId: "user_co_owner",
      role: "owner",
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const roleResolver = new MemoryWorkspaceRoleResolver();
  roleResolver.setMembership(workspaceId, owner.id, "owner");
  roleResolver.setMembership(workspaceId, admin.id, "admin");
  roleResolver.setMembership(workspaceId, member.id, "member");
  if (options?.withCoOwner) {
    roleResolver.setMembership(workspaceId, "user_co_owner", "owner");
  }

  const service = new MembershipService(workspaceRepository, createWorkspaceAccess(roleResolver), {
    async record(event: Record<string, unknown>) {
      auditEvents.push(event);
    }
  });

  return { service, workspaceRepository, auditEvents };
}

describe("MembershipService", () => {
  it("lets admins change non-owner roles", async () => {
    const { service } = createHarness();

    const updated = await service.changeMemberRole(workspaceId, member.id, "viewer", admin);

    expect(updated.role).toBe("viewer");
  });

  it("records audit events for role changes and member removal", async () => {
    const { service, auditEvents } = createHarness();

    await service.changeMemberRole(workspaceId, member.id, "viewer", admin);
    await service.removeMember(workspaceId, member.id, admin);

    expect(auditEvents).toMatchObject([
      {
        workspaceId,
        actorPrincipalId: admin.id,
        action: "workspace.member_role_changed",
        targetType: "workspace_member",
        targetId: member.id,
        metadata: {
          previousRole: "member",
          role: "viewer"
        }
      },
      {
        workspaceId,
        actorPrincipalId: admin.id,
        action: "workspace.member_removed",
        targetType: "workspace_member",
        targetId: member.id,
        metadata: {
          previousRole: "viewer"
        }
      }
    ]);
  });

  it("requires owner permission to promote someone to owner", async () => {
    const { service } = createHarness();

    await expect(service.changeMemberRole(workspaceId, member.id, "owner", admin)).rejects.toThrow(
      WorkspaceForbiddenError
    );
  });

  it("lets owners promote members to owner", async () => {
    const { service } = createHarness();

    const updated = await service.changeMemberRole(workspaceId, member.id, "owner", owner);

    expect(updated.role).toBe("owner");
  });

  it("rejects demoting the last remaining owner", async () => {
    const { service } = createHarness();

    await expect(service.changeMemberRole(workspaceId, owner.id, "admin", owner)).rejects.toThrow(
      WorkspaceMemberConflictError
    );
  });

  it("allows demoting an owner when another owner remains", async () => {
    const { service } = createHarness({ withCoOwner: true });

    const updated = await service.changeMemberRole(workspaceId, owner.id, "admin", admin);

    expect(updated.role).toBe("admin");
  });

  it("removes non-owner members for admins", async () => {
    const { service, workspaceRepository } = createHarness();

    await service.removeMember(workspaceId, member.id, admin);

    expect(await workspaceRepository.getMembership(workspaceId, member.id)).toBeUndefined();
  });

  it("rejects removing the last remaining owner", async () => {
    const { service } = createHarness();

    await expect(service.removeMember(workspaceId, owner.id, owner)).rejects.toThrow(
      WorkspaceMemberConflictError
    );
  });

  it("allows removing an owner when another owner remains", async () => {
    const { service, workspaceRepository } = createHarness({ withCoOwner: true });

    await service.removeMember(workspaceId, owner.id, admin);

    expect(await workspaceRepository.getMembership(workspaceId, owner.id)).toBeUndefined();
  });

  it("keeps at least one owner when concurrent removals race", async () => {
    const { service, workspaceRepository } = createHarness({ withCoOwner: true });
    workspaceRepository.deferListMembers = true;

    const removeOwner = service.removeMember(workspaceId, owner.id, owner);
    const removeCoOwner = service.removeMember(workspaceId, "user_co_owner", owner);
    await workspaceRepository.waitForListMembers(2);
    workspaceRepository.releaseListMembers();

    const results = await Promise.allSettled([removeOwner, removeCoOwner]);
    const members = await workspaceRepository.listMembers(workspaceId);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(members.filter((memberRecord) => memberRecord.role === "owner")).toHaveLength(1);
  });

  it("denies role changes without manage_members permission", async () => {
    const { service } = createHarness();

    await expect(service.changeMemberRole(workspaceId, member.id, "viewer", intruder)).rejects.toThrow(
      WorkspaceForbiddenError
    );
  });

  it("returns not found for unknown members", async () => {
    const { service } = createHarness();

    await expect(service.changeMemberRole(workspaceId, "missing-user", "viewer", owner)).rejects.toThrow(
      WorkspaceMemberNotFoundError
    );

    await expect(service.removeMember(workspaceId, "missing-user", owner)).rejects.toThrow(
      WorkspaceMemberNotFoundError
    );
  });
});
