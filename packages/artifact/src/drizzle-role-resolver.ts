import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { artifactPermissions, workspaceMembers } from "@agent-artifacts/db";
import {
  type ArtifactRoleContext,
  type ArtifactRoleResolver,
  baseArtifactRoleCandidates,
  actsForOwner,
  highestRole,
  workspaceRoleToArtifactRole
} from "@agent-artifacts/access";
import type { ArtifactRole, Principal } from "@agent-artifacts/shared";

export class DrizzleArtifactRoleResolver implements ArtifactRoleResolver {
  constructor(private readonly db: Database) {}

  async resolveNamespace(
    principal: Principal,
    ownerUserId: string,
    workspaceId?: string | null
  ): Promise<{ isOwnerAccount: boolean; role?: ArtifactRole }> {
    if (!workspaceId && actsForOwner(principal, ownerUserId)) {
      return { isOwnerAccount: true, role: "owner" };
    }

    const inherited = await this.resolveWorkspaceMembership(principal, workspaceId);
    if (inherited) {
      return { isOwnerAccount: false, role: inherited };
    }

    return { isOwnerAccount: false, role: undefined };
  }

  async resolveArtifact(
    principal: Principal,
    artifact: ArtifactRoleContext
  ): Promise<{ role: ArtifactRole | undefined; isOwnerAccount: boolean }> {
    if (!artifact.workspaceId && actsForOwner(principal, artifact.ownerUserId)) {
      return { role: "owner", isOwnerAccount: true };
    }

    const candidates = baseArtifactRoleCandidates(principal, artifact);
    const inherited = await this.resolveWorkspaceMembership(principal, artifact.workspaceId);
    if (inherited) {
      candidates.push(inherited);
    }

    const now = new Date();
    const permissionRows = await this.db
      .select({ role: artifactPermissions.role })
      .from(artifactPermissions)
      .where(
        and(
          eq(artifactPermissions.artifactId, artifact.id),
          isNull(artifactPermissions.revokedAt),
          or(isNull(artifactPermissions.expiresAt), sql`${artifactPermissions.expiresAt} > ${now}`),
          or(
            and(eq(artifactPermissions.subjectType, "user"), eq(artifactPermissions.subjectId, principal.id)),
            and(
              eq(artifactPermissions.subjectType, "email"),
              sql`${artifactPermissions.email} IS NOT NULL`,
              sql`length(trim(${artifactPermissions.email})) > 0`,
              principal.email
                ? sql`lower(${artifactPermissions.email}) = ${principal.email.toLowerCase()}`
                : sql`false`
            ),
            eq(artifactPermissions.subjectType, "anyone")
          )
        )
      );

    for (const row of permissionRows) candidates.push(row.role);

    return { role: highestRole(candidates), isOwnerAccount: false };
  }

  private async resolveWorkspaceMembership(
    principal: Principal,
    workspaceId: string | null | undefined
  ): Promise<ArtifactRole | undefined> {
    if (!workspaceId || principal.type !== "user") {
      return undefined;
    }

    const [member] = await this.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, principal.id)))
      .limit(1);

    if (!member) {
      return undefined;
    }

    return workspaceRoleToArtifactRole(member.role);
  }
}
