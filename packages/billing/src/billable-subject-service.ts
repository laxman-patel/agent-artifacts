import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { billableAccounts } from "@agent-artifacts/db";

export type BillableSubjectType = "personal" | "workspace";

export interface BillableAccountRecord {
  id: string;
  subjectType: BillableSubjectType;
  subjectId: string;
  dodoCustomerId: string | null;
  dodoSubscriptionId: string | null;
  planId: string | null;
  includedSeats: number;
  extraSeats: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillableAccountRepository {
  findBySubject(subjectType: BillableSubjectType, subjectId: string): Promise<BillableAccountRecord | undefined>;
  create(input: {
    id: string;
    subjectType: BillableSubjectType;
    subjectId: string;
    status: string;
  }): Promise<BillableAccountRecord>;
}

function mapBillableAccount(row: typeof billableAccounts.$inferSelect): BillableAccountRecord {
  return {
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    dodoCustomerId: row.dodoCustomerId,
    dodoSubscriptionId: row.dodoSubscriptionId,
    planId: row.planId,
    includedSeats: row.includedSeats,
    extraSeats: row.extraSeats,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export class DrizzleBillableAccountRepository implements BillableAccountRepository {
  constructor(private readonly db: Database) {}

  async findBySubject(
    subjectType: BillableSubjectType,
    subjectId: string
  ): Promise<BillableAccountRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(billableAccounts)
      .where(and(eq(billableAccounts.subjectType, subjectType), eq(billableAccounts.subjectId, subjectId)))
      .limit(1);

    return row ? mapBillableAccount(row) : undefined;
  }

  async create(input: {
    id: string;
    subjectType: BillableSubjectType;
    subjectId: string;
    status: string;
  }): Promise<BillableAccountRecord> {
    const now = new Date();
    const [row] = await this.db
      .insert(billableAccounts)
      .values({
        id: input.id,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        status: input.status,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create billable account.");
    }

    return mapBillableAccount(row);
  }
}

export class BillableSubjectService {
  constructor(private readonly repository: BillableAccountRepository) {}

  async resolveForUser(userId: string): Promise<BillableAccountRecord> {
    return this.resolveOrCreate("personal", userId);
  }

  async resolveForWorkspace(workspaceId: string): Promise<BillableAccountRecord> {
    return this.resolveOrCreate("workspace", workspaceId);
  }

  private async resolveOrCreate(
    subjectType: BillableSubjectType,
    subjectId: string
  ): Promise<BillableAccountRecord> {
    const existing = await this.repository.findBySubject(subjectType, subjectId);
    if (existing) {
      return existing;
    }

    return this.repository.create({
      id: randomUUID(),
      subjectType,
      subjectId,
      status: "inactive"
    });
  }
}

export function createDrizzleBillableSubjectService(db: Database): BillableSubjectService {
  return new BillableSubjectService(new DrizzleBillableAccountRepository(db));
}
