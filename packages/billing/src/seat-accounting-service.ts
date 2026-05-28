import { and, eq, gt, sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { workspaceInvitations, workspaceMembers } from "@agent-artifacts/db";
import type { Principal } from "@agent-artifacts/shared";
import { WorkspaceForbiddenError, WorkspaceNotFoundError } from "@agent-artifacts/shared";
import type { WorkspaceAccess } from "@agent-artifacts/workspace";
import type { WorkspaceRepository } from "@agent-artifacts/workspace";
import type { BillableAccountRecord } from "./billable-subject-service.js";
import { BillableSubjectService } from "./billable-subject-service.js";

export interface SeatUsageSummary {
  activeMembers: number;
  pendingInvitations: number;
  usedSeats: number;
  includedSeats: number;
  extraSeats: number;
  totalSeats: number;
  seatsRemaining: number;
  overLimit: boolean;
}

export interface SeatCountSnapshot {
  activeMembers: number;
  pendingInvitations: number;
}

export interface SeatCountRepository {
  countActiveMembers(workspaceId: string): Promise<number>;
  countPendingInvitations(workspaceId: string): Promise<number>;
}

export function computeSeatUsage(input: {
  activeMembers: number;
  pendingInvitations: number;
  includedSeats: number;
  extraSeats: number;
}): SeatUsageSummary {
  const usedSeats = input.activeMembers + input.pendingInvitations;
  const totalSeats = input.includedSeats + input.extraSeats;
  const seatsRemaining = Math.max(totalSeats - usedSeats, 0);

  return {
    activeMembers: input.activeMembers,
    pendingInvitations: input.pendingInvitations,
    usedSeats,
    includedSeats: input.includedSeats,
    extraSeats: input.extraSeats,
    totalSeats,
    seatsRemaining,
    overLimit: usedSeats > totalSeats
  };
}

export class DrizzleSeatCountRepository implements SeatCountRepository {
  constructor(private readonly db: Database) {}

  async countActiveMembers(workspaceId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    return result?.count ?? 0;
  }

  async countPendingInvitations(workspaceId: string): Promise<number> {
    const now = new Date();
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          eq(workspaceInvitations.state, "pending"),
          gt(workspaceInvitations.expiresAt, now)
        )
      );

    return result?.count ?? 0;
  }
}

export interface WorkspaceBillingSummary {
  account: BillableAccountRecord;
  seats: SeatUsageSummary;
}

export class SeatAccountingService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly seatCountRepository: SeatCountRepository,
    private readonly billableSubjectService: BillableSubjectService,
    private readonly access: WorkspaceAccess
  ) {}

  async getWorkspaceSeatUsage(
    workspaceId: string,
    principal: Principal
  ): Promise<WorkspaceBillingSummary> {
    if (principal.type !== "user") {
      throw new WorkspaceForbiddenError("Only signed-in users can view workspace billing.");
    }

    const workspace = await this.workspaceRepository.getById(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError();
    }

    await this.access.assertAuthorized({
      principal,
      action: "workspace.manage_billing",
      context: { workspaceId }
    });

    const account = await this.billableSubjectService.resolveForWorkspace(workspaceId);
    const counts = await this.loadSeatCounts(workspaceId);

    return {
      account,
      seats: computeSeatUsage({
        ...counts,
        includedSeats: account.includedSeats,
        extraSeats: account.extraSeats
      })
    };
  }

  async loadSeatCounts(workspaceId: string): Promise<SeatCountSnapshot> {
    const [activeMembers, pendingInvitations] = await Promise.all([
      this.seatCountRepository.countActiveMembers(workspaceId),
      this.seatCountRepository.countPendingInvitations(workspaceId)
    ]);

    return { activeMembers, pendingInvitations };
  }
}

export function createDrizzleSeatAccountingService(
  db: Database,
  billableSubjectService: BillableSubjectService,
  workspaceRepository: WorkspaceRepository,
  access: WorkspaceAccess
): SeatAccountingService {
  return new SeatAccountingService(
    workspaceRepository,
    new DrizzleSeatCountRepository(db),
    billableSubjectService,
    access
  );
}
