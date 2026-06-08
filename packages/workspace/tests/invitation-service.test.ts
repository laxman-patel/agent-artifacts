import { describe, expect, it } from "vitest";
import type { Principal, WorkspaceRole } from "@agent-artifacts/shared";
import { WorkspaceForbiddenError } from "@agent-artifacts/shared";
import { MemoryWorkspaceRoleResolver, createWorkspaceAccess } from "../src/access.js";
import {
  InvitationService,
  MemoryInvitationRepository,
  WorkspaceInvitationConflictError,
  WorkspaceInvitationExpiredError,
  WorkspaceInvitationNotFoundError,
  hashInvitationToken
} from "../src/invitation-service.js";
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
  onAddMember?: () => Promise<void>;

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
    await this.onAddMember?.();
  }

  async listMembershipsForUser(): Promise<Array<WorkspaceRecord & { role: "owner" }>> {
    return [];
  }

  async listMembers(): Promise<WorkspaceMemberRecord[]> {
    return [...this.members.values()];
  }

  async getMembership(workspaceId: string, userId: string): Promise<WorkspaceMemberRecord | undefined> {
    return this.members.get(this.memberKey(workspaceId, userId));
  }

  async updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<boolean> {
    const member = this.members.get(this.memberKey(workspaceId, userId));
    if (!member) {
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
    return this.members.delete(this.memberKey(workspaceId, userId));
  }
}

const workspaceId = "ws_team_1";
const appUrl = "https://app.example.com";

const owner: Principal = {
  type: "user",
  id: "user_owner",
  ownerUserId: "user_owner",
  email: "owner@example.com",
  scopes: []
};

const invitee: Principal = {
  type: "user",
  id: "user_invitee",
  ownerUserId: "user_invitee",
  email: "invitee@example.com",
  scopes: []
};

const intruder: Principal = {
  type: "user",
  id: "user_other",
  ownerUserId: "user_other",
  email: "other@example.com",
  scopes: []
};

function createHarness() {
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

  const invitationRepository = new MemoryInvitationRepository(workspaceRepository);
  const roleResolver = new MemoryWorkspaceRoleResolver();
  roleResolver.setMembership(workspaceId, owner.id, "owner");

  const service = new InvitationService(
    invitationRepository,
    workspaceRepository,
    createWorkspaceAccess(roleResolver),
    appUrl,
    {
      async record(event: Record<string, unknown>) {
        auditEvents.push(event);
      }
    }
  );

  return { service, invitationRepository, workspaceRepository, auditEvents };
}

describe("InvitationService", () => {
  it("creates an invitation when the inviter can manage members", async () => {
    const { service, auditEvents } = createHarness();

    const created = await service.createInvitation(workspaceId, "invitee@example.com", "member", owner);

    expect(created.email).toBe("invitee@example.com");
    expect(created.role).toBe("member");
    expect(created.acceptUrl).toMatch(/^https:\/\/app\.example\.com\/team-invite\//);
    expect(auditEvents).toMatchObject([
      {
        workspaceId,
        actorPrincipalId: owner.id,
        action: "workspace.invitation_created",
        targetType: "workspace_invitation",
        targetId: created.id,
        metadata: {
          email: "invitee@example.com",
          role: "member"
        }
      }
    ]);
  });

  it("denies invitation creation without manage_members permission", async () => {
    const { service } = createHarness();

    await expect(
      service.createInvitation(workspaceId, "invitee@example.com", "member", intruder)
    ).rejects.toThrow(WorkspaceForbiddenError);
  });

  it("rejects duplicate pending invitations for the same email", async () => {
    const { service } = createHarness();

    await service.createInvitation(workspaceId, "invitee@example.com", "member", owner);

    await expect(
      service.createInvitation(workspaceId, "invitee@example.com", "viewer", owner)
    ).rejects.toThrow(WorkspaceInvitationConflictError);
  });

  it("allows re-inviting when an existing pending invitation has expired", async () => {
    const { service, invitationRepository } = createHarness();

    await invitationRepository.create({
      id: "inv_expired_pending",
      workspaceId,
      email: "invitee@example.com",
      role: "member",
      tokenHash: hashInvitationToken("expired-token"),
      invitedByUserId: owner.id,
      expiresAt: new Date(Date.now() - 60_000)
    });

    const created = await service.createInvitation(workspaceId, "invitee@example.com", "viewer", owner);

    await expect(invitationRepository.getById("inv_expired_pending")).resolves.toMatchObject({ state: "expired" });
    expect(created.id).not.toBe("inv_expired_pending");
    expect(created.role).toBe("viewer");
  });

  it("accepts an invitation and creates membership", async () => {
    const { service, invitationRepository, workspaceRepository, auditEvents } = createHarness();
    const token = "invite-token-123";

    await invitationRepository.create({
      id: "inv_1",
      workspaceId,
      email: "invitee@example.com",
      role: "admin",
      tokenHash: hashInvitationToken(token),
      invitedByUserId: owner.id,
      expiresAt: new Date(Date.now() + 60_000)
    });

    const result = await service.acceptInvitation(token, invitee);

    expect(result).toEqual({ workspaceId, role: "admin" });
    const membership = await workspaceRepository.getMembership(workspaceId, invitee.id);
    expect(membership?.role).toBe("admin");
    expect(auditEvents).toMatchObject([
      {
        workspaceId,
        actorPrincipalId: invitee.id,
        action: "workspace.invitation_accepted",
        targetType: "workspace_invitation",
        targetId: "inv_1",
        metadata: {
          email: "invitee@example.com",
          role: "admin",
          memberUserId: invitee.id
        }
      }
    ]);
  });

  it("does not leave membership behind when invitation acceptance loses a state race", async () => {
    const { service, invitationRepository, workspaceRepository } = createHarness();
    const token = "race-token";

    await invitationRepository.create({
      id: "inv_race",
      workspaceId,
      email: "invitee@example.com",
      role: "member",
      tokenHash: hashInvitationToken(token),
      invitedByUserId: owner.id,
      expiresAt: new Date(Date.now() + 60_000)
    });
    invitationRepository.rejectNextAcceptPendingInvitation = true;

    await expect(service.acceptInvitation(token, invitee)).rejects.toThrow(WorkspaceInvitationConflictError);
    await expect(workspaceRepository.getMembership(workspaceId, invitee.id)).resolves.toBeUndefined();
  });

  it("rejects acceptance when the signed-in email does not match", async () => {
    const { service, invitationRepository } = createHarness();
    const token = "invite-token-456";

    await invitationRepository.create({
      id: "inv_2",
      workspaceId,
      email: "someone-else@example.com",
      role: "member",
      tokenHash: hashInvitationToken(token),
      invitedByUserId: owner.id,
      expiresAt: new Date(Date.now() + 60_000)
    });

    await expect(service.acceptInvitation(token, invitee)).rejects.toThrow(WorkspaceForbiddenError);
  });

  it("marks expired invitations and rejects acceptance", async () => {
    const { service, invitationRepository } = createHarness();
    const token = "expired-token";

    await invitationRepository.create({
      id: "inv_3",
      workspaceId,
      email: "invitee@example.com",
      role: "member",
      tokenHash: hashInvitationToken(token),
      invitedByUserId: owner.id,
      expiresAt: new Date(Date.now() - 60_000)
    });

    await expect(service.acceptInvitation(token, invitee)).rejects.toThrow(WorkspaceInvitationExpiredError);

    const invitation = await invitationRepository.getById("inv_3");
    expect(invitation?.state).toBe("expired");
  });

  it("revokes pending invitations for managers", async () => {
    const { service, invitationRepository } = createHarness();
    const token = "revoke-token";

    await invitationRepository.create({
      id: "inv_4",
      workspaceId,
      email: "invitee@example.com",
      role: "member",
      tokenHash: hashInvitationToken(token),
      invitedByUserId: owner.id,
      expiresAt: new Date(Date.now() + 60_000)
    });

    await service.revokeInvitation("inv_4", owner);

    const invitation = await invitationRepository.getById("inv_4");
    expect(invitation?.state).toBe("revoked");
    expect(invitation?.revokedAt).toBeInstanceOf(Date);
  });

  it("resends pending invitations with a fresh token and expiry", async () => {
    const { service, invitationRepository } = createHarness();
    const originalToken = "original-token";
    const originalExpiry = new Date(Date.now() + 60_000);

    await invitationRepository.create({
      id: "inv_5",
      workspaceId,
      email: "invitee@example.com",
      role: "member",
      tokenHash: hashInvitationToken(originalToken),
      invitedByUserId: owner.id,
      expiresAt: originalExpiry
    });

    const resent = await service.resendInvitation("inv_5", owner);

    expect(resent.acceptUrl).toContain("/team-invite/");
    expect(new Date(resent.expiresAt).getTime()).toBeGreaterThan(originalExpiry.getTime());

    await expect(service.acceptInvitation(originalToken, invitee)).rejects.toThrow(
      WorkspaceInvitationNotFoundError
    );
  });

  it("lists non-expired pending invitations for managers", async () => {
    const { service, invitationRepository } = createHarness();

    await invitationRepository.create({
      id: "inv_active",
      workspaceId,
      email: "active@example.com",
      role: "member",
      tokenHash: hashInvitationToken("active-token"),
      invitedByUserId: owner.id,
      expiresAt: new Date(Date.now() + 60_000)
    });

    await invitationRepository.create({
      id: "inv_expired",
      workspaceId,
      email: "expired@example.com",
      role: "viewer",
      tokenHash: hashInvitationToken("expired-token"),
      invitedByUserId: owner.id,
      expiresAt: new Date(Date.now() - 60_000)
    });

    const invitations = await service.listPendingInvitations(workspaceId, owner);

    expect(invitations).toHaveLength(1);
    expect(invitations[0]?.email).toBe("active@example.com");
  });
});
