import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import type { BillingService } from "@agent-artifacts/billing";
import type { Database } from "@agent-artifacts/db";
import { auditEvents, userProfiles, users } from "@agent-artifacts/db";

type AuditEventRecord = typeof auditEvents.$inferSelect;
export type AuditEventWithActor = AuditEventRecord & {
  actorDisplayName: string | null;
  actorUsername: string | null;
};

export class AuditService {
  constructor(
    private readonly db: Database,
    private readonly billing?: Pick<BillingService, "getAccountEntitlements">
  ) {}

  async listAuditEvents(input: {
    ownerUserId?: string;
    workspaceId?: string;
    artifactId?: string;
    retentionOwnerUserId?: string;
    limit?: number;
  }): Promise<AuditEventWithActor[]> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const conditions = [];

    if (input.workspaceId) {
      conditions.push(eq(auditEvents.workspaceId, input.workspaceId));
    } else if (input.ownerUserId) {
      conditions.push(eq(auditEvents.ownerUserId, input.ownerUserId));
    }

    if (input.artifactId) {
      conditions.push(eq(auditEvents.artifactId, input.artifactId));
    }

    const retentionOwnerUserId = input.retentionOwnerUserId ?? input.ownerUserId;
    const cutoff = retentionOwnerUserId ? await this.auditRetentionCutoff(retentionOwnerUserId) : undefined;
    if (cutoff) {
      conditions.push(gte(auditEvents.createdAt, cutoff));
    }

    if (conditions.length === 0) {
      return [];
    }

    const events = await this.db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);

    return this.withActorProfiles(events);
  }

  async pruneExpiredAuditEventsForOwners(ownerUserIds: string[]): Promise<number> {
    let deletedCount = 0;
    for (const ownerUserId of ownerUserIds) {
      const cutoff = await this.auditRetentionCutoff(ownerUserId);
      if (!cutoff) {
        continue;
      }

      const deleted = await this.db
        .delete(auditEvents)
        .where(and(eq(auditEvents.ownerUserId, ownerUserId), lt(auditEvents.createdAt, cutoff)))
        .returning({ id: auditEvents.id });
      deletedCount += deleted.length;
    }

    return deletedCount;
  }

  private async auditRetentionCutoff(ownerUserId: string): Promise<Date | undefined> {
    const entitlements = await this.billing?.getAccountEntitlements(ownerUserId);
    const days = entitlements?.plan.entitlements.auditRetentionDays;
    if (!days) {
      return undefined;
    }
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private async withActorProfiles(events: AuditEventRecord[]): Promise<AuditEventWithActor[]> {
    const userIds = [...new Set(events.filter((event) => event.actorPrincipalType === "user").map((event) => event.actorPrincipalId))];
    if (userIds.length === 0) {
      return events.map((event) => ({ ...event, actorDisplayName: null, actorUsername: null }));
    }

    const profiles = await this.db
      .select({
        userId: users.id,
        name: users.name,
        displayName: userProfiles.displayName,
        username: userProfiles.username
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(inArray(users.id, userIds));

    const byUserId = new Map(profiles.map((profile) => [profile.userId, profile]));

    return events.map((event) => {
      const profile = byUserId.get(event.actorPrincipalId);
      return {
        ...event,
        actorDisplayName: profile?.displayName ?? profile?.name ?? null,
        actorUsername: profile?.username ?? null
      };
    });
  }
}
