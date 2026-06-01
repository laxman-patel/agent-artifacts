import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { auditEvents } from "@agent-artifacts/db";

export class AuditService {
  constructor(private readonly db: Database) {}

  async listAuditEvents(input: {
    ownerUserId?: string;
    workspaceId?: string;
    artifactId?: string;
    limit?: number;
  }): Promise<(typeof auditEvents.$inferSelect)[]> {
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

    if (conditions.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);
  }
}
