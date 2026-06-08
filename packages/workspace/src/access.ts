import type { Principal, WorkspaceAction, WorkspaceRole } from "@agent-artifacts/shared";
import { WorkspaceForbiddenError } from "@agent-artifacts/shared";
import { canPerformWorkspaceAction } from "./policy.js";

export type WorkspaceAccessDecision =
  | { allowed: true; effectiveRole: WorkspaceRole }
  | { allowed: false; reason: string };

export interface WorkspaceMembershipContext {
  workspaceId: string;
}

export interface WorkspaceRoleResolver {
  resolveMembership(
    principal: Principal,
    workspaceId: string
  ): Promise<{ role: WorkspaceRole | undefined }>;
}

export interface WorkspaceAccess {
  authorize(input: {
    principal: Principal;
    action: WorkspaceAction;
    context: WorkspaceMembershipContext;
  }): Promise<WorkspaceAccessDecision>;
  assertAuthorized(input: {
    principal: Principal;
    action: WorkspaceAction;
    context: WorkspaceMembershipContext;
  }): Promise<void>;
}

export async function authorizeWorkspaceAction(
  resolver: WorkspaceRoleResolver,
  input: {
    principal: Principal;
    action: WorkspaceAction;
    context: WorkspaceMembershipContext;
  }
): Promise<WorkspaceAccessDecision> {
  if (input.principal.type !== "user") {
    return { allowed: false, reason: "Only signed-in users can access teams." };
  }

  const { role } = await resolver.resolveMembership(input.principal, input.context.workspaceId);
  const decision = canPerformWorkspaceAction({ action: input.action, role });

  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason };
  }

  return { allowed: true, effectiveRole: role! };
}

export function assertWorkspaceAuthorized(
  decision: WorkspaceAccessDecision
): asserts decision is { allowed: true; effectiveRole: WorkspaceRole } {
  if (!decision.allowed) {
    throw new WorkspaceForbiddenError(decision.reason);
  }
}

export function createWorkspaceAccess(resolver: WorkspaceRoleResolver): WorkspaceAccess {
  return {
    authorize(input) {
      return authorizeWorkspaceAction(resolver, input);
    },
    async assertAuthorized(input) {
      const decision = await authorizeWorkspaceAction(resolver, input);
      assertWorkspaceAuthorized(decision);
    }
  };
}

export class MemoryWorkspaceRoleResolver implements WorkspaceRoleResolver {
  private readonly memberships = new Map<string, WorkspaceRole>();

  membershipKey(workspaceId: string, userId: string): string {
    return `${workspaceId}:${userId}`;
  }

  setMembership(workspaceId: string, userId: string, role: WorkspaceRole): void {
    this.memberships.set(this.membershipKey(workspaceId, userId), role);
  }

  async resolveMembership(
    principal: Principal,
    workspaceId: string
  ): Promise<{ role: WorkspaceRole | undefined }> {
    return {
      role: this.memberships.get(this.membershipKey(workspaceId, principal.id))
    };
  }
}
