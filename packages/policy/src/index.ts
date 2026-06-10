import type {
  AgentScope,
  ArtifactAction,
  ArtifactRole,
  Principal,
} from "@agent-artifacts/shared";

export const roleRank: Record<ArtifactRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

const actionMinimumRole: Record<ArtifactAction, ArtifactRole> = {
  "artifact.view": "viewer",
  "artifact.create": "owner",
  "project.view": "viewer",
  "artifact.update": "editor",
  "artifact.restore": "editor",
  "artifact.diff": "viewer",
  "artifact.delete": "owner",
  "artifact.manage_access": "admin",
  "artifact.create_share_link": "admin",
  "artifact.revoke_share_link": "admin",
  "account.manage_agents": "owner",
  "account.manage_api_keys": "owner",
};

const actionScope: Partial<Record<ArtifactAction, AgentScope>> = {
  "artifact.view": "artifacts:read",
  "artifact.create": "artifacts:create",
  "artifact.update": "artifacts:update",
  "artifact.restore": "artifacts:update",
  "artifact.diff": "artifacts:read",
  "artifact.delete": "artifacts:delete",
  "artifact.manage_access": "artifacts:access:write",
  "artifact.create_share_link": "artifacts:share",
  "artifact.revoke_share_link": "artifacts:share",
  "account.manage_agents": "agents:manage",
};

export type PolicyDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: string;
    };

export interface ArtifactPolicyInput {
  principal: Principal;
  action: ArtifactAction;
  role?: ArtifactRole;
  isOwnerAccount?: boolean;
}

export function hasRole(
  role: ArtifactRole | undefined,
  required: ArtifactRole,
): boolean {
  return role !== undefined && roleRank[role]! >= roleRank[required]!;
}

export function hasScope(
  principal: Principal,
  requiredScope: AgentScope | undefined,
): boolean {
  if (requiredScope === undefined) {
    return true;
  }

  if (principal.type === "user") {
    return true;
  }

  return principal.scopes.includes(requiredScope);
}

export function canPerformArtifactAction(
  input: ArtifactPolicyInput,
): PolicyDecision {
  const requiredRole = actionMinimumRole[input.action];
  const effectiveRole = input.isOwnerAccount ? "owner" : input.role;

  if (!hasRole(effectiveRole, requiredRole)) {
    return {
      allowed: false,
      reason: `Requires ${requiredRole} role for ${input.action}.`,
    };
  }

  const requiredScope = actionScope[input.action];
  if (!hasScope(input.principal, requiredScope)) {
    return {
      allowed: false,
      reason: `Requires ${requiredScope} scope for ${input.action}.`,
    };
  }

  return { allowed: true };
}
