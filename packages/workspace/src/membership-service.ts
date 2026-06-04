import type { Database } from "@agent-artifacts/db";
import type { Principal, WorkspaceRole } from "@agent-artifacts/shared";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
  workspaceRoleSchema
} from "@agent-artifacts/shared";
import { z } from "zod";
import type { WorkspaceAccess } from "./access.js";
import { createWorkspaceAccess } from "./access.js";
import { auditOwnerUserId, DrizzleWorkspaceAuditSink, type WorkspaceAuditSink } from "./audit.js";
import type { WorkspaceMemberRecord, WorkspaceRepository } from "./workspace-service.js";
import {
  DrizzleWorkspaceRepository,
  DrizzleWorkspaceRoleResolver
} from "./workspace-service.js";

export class WorkspaceMemberNotFoundError extends Error {
  constructor(message = "Workspace member not found.") {
    super(message);
    this.name = "WorkspaceMemberNotFoundError";
  }
}

export class WorkspaceMemberConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceMemberConflictError";
  }
}

export const changeMemberRoleInputSchema = z.object({
  role: workspaceRoleSchema
});

export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleInputSchema>;

function countOwners(members: WorkspaceMemberRecord[]): number {
  return members.filter((member) => member.role === "owner").length;
}

function assertAtLeastOneOwnerRemains(
  members: WorkspaceMemberRecord[],
  targetUserId: string,
  nextRole?: WorkspaceRole
): void {
  const target = members.find((member) => member.userId === targetUserId);
  if (!target || target.role !== "owner") {
    return;
  }

  const ownersAfterChange =
    nextRole === undefined
      ? countOwners(members) - 1
      : countOwners(members.map((member) => (member.userId === targetUserId ? { ...member, role: nextRole } : member)));

  if (ownersAfterChange < 1) {
    throw new WorkspaceMemberConflictError("The workspace must have at least one owner.");
  }
}

export class MembershipService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly access: WorkspaceAccess,
    private readonly audit?: WorkspaceAuditSink
  ) {}

  async changeMemberRole(
    workspaceId: string,
    memberUserId: string,
    newRole: WorkspaceRole,
    principal: Principal
  ): Promise<WorkspaceMemberRecord> {
    if (principal.type !== "user") {
      throw new WorkspaceForbiddenError("Only signed-in users can change workspace member roles.");
    }

    const parsed = changeMemberRoleInputSchema.parse({ role: newRole });

    const workspace = await this.workspaceRepository.getById(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError();
    }

    const decision = await this.access.authorize({
      principal,
      action: "workspace.manage_members",
      context: { workspaceId }
    });
    if (!decision.allowed) {
      throw new WorkspaceForbiddenError(decision.reason);
    }

    if (parsed.role === "owner" && decision.effectiveRole !== "owner") {
      throw new WorkspaceForbiddenError("Only workspace owners can grant the owner role.");
    }

    const membership = await this.workspaceRepository.getMembership(workspaceId, memberUserId);
    if (!membership) {
      throw new WorkspaceMemberNotFoundError();
    }

    if (membership.role === parsed.role) {
      return membership;
    }

    const members = await this.workspaceRepository.listMembers(workspaceId);
    assertAtLeastOneOwnerRemains(members, memberUserId, parsed.role);

    if (!(await this.workspaceRepository.updateMemberRole(workspaceId, memberUserId, parsed.role))) {
      throw new WorkspaceMemberConflictError("The workspace must have at least one owner.");
    }
    await this.recordAudit(workspaceId, principal, "workspace.member_role_changed", "workspace_member", memberUserId, {
      previousRole: membership.role,
      role: parsed.role
    });

    const updated = await this.workspaceRepository.getMembership(workspaceId, memberUserId);
    if (!updated) {
      throw new WorkspaceMemberNotFoundError();
    }

    return updated;
  }

  async removeMember(workspaceId: string, memberUserId: string, principal: Principal): Promise<void> {
    if (principal.type !== "user") {
      throw new WorkspaceForbiddenError("Only signed-in users can remove workspace members.");
    }

    const workspace = await this.workspaceRepository.getById(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError();
    }

    await this.access.assertAuthorized({
      principal,
      action: "workspace.manage_members",
      context: { workspaceId }
    });

    const membership = await this.workspaceRepository.getMembership(workspaceId, memberUserId);
    if (!membership) {
      throw new WorkspaceMemberNotFoundError();
    }

    const members = await this.workspaceRepository.listMembers(workspaceId);
    assertAtLeastOneOwnerRemains(members, memberUserId);

    if (!(await this.workspaceRepository.removeMember(workspaceId, memberUserId))) {
      throw new WorkspaceMemberConflictError("The workspace must have at least one owner.");
    }
    await this.recordAudit(workspaceId, principal, "workspace.member_removed", "workspace_member", memberUserId, {
      previousRole: membership.role
    });
  }

  private async recordAudit(
    workspaceId: string,
    principal: Principal,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.audit?.record({
      ownerUserId: auditOwnerUserId(principal),
      workspaceId,
      actorPrincipalType: principal.type,
      actorPrincipalId: principal.id,
      action,
      targetType,
      targetId,
      metadata
    });
  }
}

export function createDrizzleMembershipService(db: Database): MembershipService {
  const workspaceRepository = new DrizzleWorkspaceRepository(db);
  const access = createWorkspaceAccess(new DrizzleWorkspaceRoleResolver(workspaceRepository));
  return new MembershipService(workspaceRepository, access, new DrizzleWorkspaceAuditSink(db));
}
