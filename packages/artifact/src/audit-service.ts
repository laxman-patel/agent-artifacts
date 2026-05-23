import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { auditEvents } from "@agent-artifacts/db";

export class AuditService {
  constructor(private readonly db: Database) {}

  async listAuditEvents(
    ownerUserId: string,
    input: { artifactId?: string; limit?: number }
  ): Promise<(typeof auditEvents.$inferSelect)[]> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const conditions = [eq(auditEvents.ownerUserId, ownerUserId)];

    if (input.artifactId) {
      conditions.push(eq(auditEvents.artifactId, input.artifactId));
    }

    return this.db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);
  }
}
