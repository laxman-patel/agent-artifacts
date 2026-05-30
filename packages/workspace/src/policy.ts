import type { WorkspaceAction, WorkspaceRole } from "@agent-artifacts/shared";

export const workspaceRoleRank: Record<Exclude<WorkspaceRole, "billing_admin">, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4
};

const actionMinimumRole: Record<
  Exclude<WorkspaceAction, "workspace.manage_billing">,
  Exclude<WorkspaceRole, "billing_admin">
> = {
  "workspace.view": "viewer",
  "workspace.update": "admin",
  "workspace.manage_members": "admin",
  "workspace.create_content": "member",
  "workspace.delete": "owner"
};

const billingAdminAllowedActions = new Set<WorkspaceAction>(["workspace.view", "workspace.manage_billing"]);

export type WorkspacePolicyDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: string;
    };

export function hasWorkspaceRole(
  role: Exclude<WorkspaceRole, "billing_admin"> | undefined,
  required: Exclude<WorkspaceRole, "billing_admin">
): boolean {
  return role !== undefined && workspaceRoleRank[role]! >= workspaceRoleRank[required]!;
}

export function canPerformWorkspaceAction(input: {
  action: WorkspaceAction;
  role: WorkspaceRole | undefined;
}): WorkspacePolicyDecision {
  const { action, role } = input;

  if (role === undefined) {
    return { allowed: false, reason: "Not a workspace member." };
  }

  if (role === "billing_admin") {
    return billingAdminAllowedActions.has(action)
      ? { allowed: true }
      : { allowed: false, reason: `Billing admins cannot perform ${action}.` };
  }

  if (action === "workspace.manage_billing") {
    return role === "owner"
      ? { allowed: true }
      : { allowed: false, reason: "Requires billing_admin or owner role for workspace.manage_billing." };
  }

  const requiredRole = actionMinimumRole[action];
  if (!hasWorkspaceRole(role, requiredRole)) {
    return {
      allowed: false,
      reason: `Requires ${requiredRole} role for ${action}.`
    };
  }

  return { allowed: true };
}
