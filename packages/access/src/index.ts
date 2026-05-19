import { canPerformArtifactAction } from "@agent-artifacts/policy";
import type { ArtifactAction, ArtifactRole, Principal } from "@agent-artifacts/shared";
import { ArtifactForbiddenError, artifactRoleSchema } from "@agent-artifacts/shared";

export { ArtifactForbiddenError } from "@agent-artifacts/shared";

const NAMESPACE_ACTIONS = new Set<ArtifactAction>(["artifact.create"]);

export function actsForOwner(principal: Principal, ownerUserId: string): boolean {
  return principal.id === ownerUserId || principal.ownerUserId === ownerUserId;
}

export interface ArtifactRoleContext {
  id: string;
  ownerUserId: string;
  publicView: boolean;
  publicEdit: boolean;
}

export interface NamespaceAccessContext {
  kind: "namespace";
  ownerUserId: string;
}

export interface ArtifactAccessContext {
  kind: "artifact";
  artifact: ArtifactRoleContext;
}

export type AccessContext = NamespaceAccessContext | ArtifactAccessContext;

export type AccessDecision =
  | { allowed: true; effectiveRole?: ArtifactRole }
  | { allowed: false; reason: string };

export interface ArtifactRoleResolver {
  resolveNamespace(principal: Principal, ownerUserId: string): Promise<{ isOwnerAccount: boolean }>;
  resolveArtifact(
    principal: Principal,
    artifact: ArtifactRoleContext
  ): Promise<{ role: ArtifactRole | undefined; isOwnerAccount: boolean }>;
}

export interface AuthorizeInput {
  principal: Principal;
  action: ArtifactAction;
  context: AccessContext;
}

export interface ArtifactAccess {
  authorize(input: AuthorizeInput): Promise<AccessDecision>;
  assertAuthorized(input: AuthorizeInput): Promise<void>;
}

export function highestRole(roles: ArtifactRole[]): ArtifactRole | undefined {
  const rank: Record<ArtifactRole, number> = {
    viewer: 1,
    editor: 2,
    admin: 3,
    owner: 4
  };

  return roles
    .map((role) => artifactRoleSchema.parse(role))
    .sort((left, right) => rank[right]! - rank[left]!)
    .at(0);
}

export async function authorize(
  resolver: ArtifactRoleResolver,
  input: AuthorizeInput
): Promise<AccessDecision> {
  const { principal, action, context } = input;

  if (context.kind === "namespace") {
    if (!NAMESPACE_ACTIONS.has(action)) {
      return { allowed: false, reason: `Action ${action} is not valid for namespace context.` };
    }

    const { isOwnerAccount } = await resolver.resolveNamespace(principal, context.ownerUserId);
    const decision = canPerformArtifactAction({ principal, action, isOwnerAccount });
    if (!decision.allowed) {
      return { allowed: false, reason: decision.reason };
    }

    return { allowed: true, effectiveRole: isOwnerAccount ? "owner" : undefined };
  }

  if (NAMESPACE_ACTIONS.has(action) || action.startsWith("account.")) {
    return { allowed: false, reason: `Action ${action} is not valid for artifact context.` };
  }

  const { role, isOwnerAccount } = await resolver.resolveArtifact(principal, context.artifact);
  const decision = canPerformArtifactAction({ principal, action, role, isOwnerAccount });
  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason };
  }

  return { allowed: true, effectiveRole: isOwnerAccount ? "owner" : role };
}

export function assertAuthorized(
  decision: AccessDecision
): asserts decision is { allowed: true; effectiveRole?: ArtifactRole } {
  if (!decision.allowed) {
    throw new ArtifactForbiddenError(decision.reason);
  }
}

export function createArtifactAccess(resolver: ArtifactRoleResolver): ArtifactAccess {
  return {
    authorize(input) {
      return authorize(resolver, input);
    },
    async assertAuthorized(input) {
      const decision = await authorize(resolver, input);
      assertAuthorized(decision);
    }
  };
}

export class MemoryArtifactRoleResolver implements ArtifactRoleResolver {
  private readonly emailViewersByArtifact = new Map<string, Set<string>>();

  grantEmailViewer(artifactId: string, email: string): void {
    const normalized = email.trim().toLowerCase();
    const viewers = this.emailViewersByArtifact.get(artifactId) ?? new Set<string>();
    viewers.add(normalized);
    this.emailViewersByArtifact.set(artifactId, viewers);
  }

  async resolveNamespace(principal: Principal, ownerUserId: string): Promise<{ isOwnerAccount: boolean }> {
    return { isOwnerAccount: actsForOwner(principal, ownerUserId) };
  }

  async resolveArtifact(
    principal: Principal,
    artifact: ArtifactRoleContext
  ): Promise<{ role: ArtifactRole | undefined; isOwnerAccount: boolean }> {
    if (actsForOwner(principal, artifact.ownerUserId)) {
      return { role: "owner", isOwnerAccount: true };
    }

    const candidates: ArtifactRole[] = [];
    const shareGrant = principal.artifactRoleGrants?.[artifact.id];
    if (shareGrant) candidates.push(shareGrant);

    if (artifact.publicEdit) candidates.push("editor");
    else if (artifact.publicView) candidates.push("viewer");

    const viewers = this.emailViewersByArtifact.get(artifact.id);
    if (principal.email && viewers?.has(principal.email.toLowerCase())) {
      candidates.push("viewer");
    }

    return { role: highestRole(candidates), isOwnerAccount: false };
  }
}
