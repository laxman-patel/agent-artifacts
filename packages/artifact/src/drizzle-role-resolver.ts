import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { artifactPermissions } from "@agent-artifacts/db";
import {
  type ArtifactRoleContext,
  type ArtifactRoleResolver,
  baseArtifactRoleCandidates,
  actsForOwner,
  highestRole
} from "@agent-artifacts/access";
import type { ArtifactRole, Principal } from "@agent-artifacts/shared";

export class DrizzleArtifactRoleResolver implements ArtifactRoleResolver {
  constructor(private readonly db: Database) {}

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

    const candidates = baseArtifactRoleCandidates(principal, artifact);

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
}
