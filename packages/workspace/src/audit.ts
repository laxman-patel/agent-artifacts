import { randomUUID } from "node:crypto";
import { auditEvents, type Database } from "@agent-artifacts/db";
import type { Principal } from "@agent-artifacts/shared";

export interface WorkspaceAuditInput {
  ownerUserId: string;
  workspaceId: string;
  actorPrincipalType: Principal["type"];
  actorPrincipalId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceAuditSink {
  record(input: WorkspaceAuditInput): Promise<void>;
}

export function auditOwnerUserId(principal: Principal): string {
  return principal.ownerUserId ?? principal.id;
}

export class DrizzleWorkspaceAuditSink implements WorkspaceAuditSink {
  constructor(private readonly db: Database) {}

  async record(input: WorkspaceAuditInput): Promise<void> {
    await this.db.insert(auditEvents).values({
      id: randomUUID(),
      ownerUserId: input.ownerUserId,
      workspaceId: input.workspaceId,
      artifactId: null,
      actorPrincipalType: input.actorPrincipalType,
      actorPrincipalId: input.actorPrincipalId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? {}
    });
  }
}
