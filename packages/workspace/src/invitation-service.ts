import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { users, workspaceInvitations } from "@agent-artifacts/db";
import type { Principal, WorkspaceRole } from "@agent-artifacts/shared";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError
} from "@agent-artifacts/shared";
import { z } from "zod";
import type { WorkspaceAccess } from "./access.js";
import { createWorkspaceAccess } from "./access.js";
import { auditOwnerUserId, DrizzleWorkspaceAuditSink, type WorkspaceAuditSink } from "./audit.js";
import type { WorkspaceRepository } from "./workspace-service.js";
import { DrizzleWorkspaceRepository, DrizzleWorkspaceRoleResolver } from "./workspace-service.js";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type WorkspaceInvitationState = "pending" | "accepted" | "revoked" | "expired";

export interface WorkspaceInvitationRecord {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  tokenHash: string;
  invitedByUserId: string;
  state: WorkspaceInvitationState;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface WorkspaceInvitationSummary {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedByUserId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreatedWorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  acceptUrl: string;
  expiresAt: string;
}

export interface ResentWorkspaceInvitation {
  id: string;
  acceptUrl: string;
  expiresAt: string;
}

export class WorkspaceInvitationNotFoundError extends Error {
  constructor(message = "Workspace invitation not found.") {
    super(message);
    this.name = "WorkspaceInvitationNotFoundError";
  }
}

export class WorkspaceInvitationExpiredError extends Error {
  constructor() {
    super("Workspace invitation has expired.");
    this.name = "WorkspaceInvitationExpiredError";
  }
}

export class WorkspaceInvitationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceInvitationConflictError";
  }
}

export const invitableWorkspaceRoleSchema = z.enum(["admin", "member", "viewer", "billing_admin"]);
export type InvitableWorkspaceRole = z.infer<typeof invitableWorkspaceRoleSchema>;

export const createWorkspaceInvitationInputSchema = z.object({
  email: z.email(),
  role: invitableWorkspaceRoleSchema
});

export type CreateWorkspaceInvitationInput = z.infer<typeof createWorkspaceInvitationInputSchema>;

export interface PersistCreateInvitationInput {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  tokenHash: string;
  invitedByUserId: string;
  expiresAt: Date;
}

export interface InvitationRepository {
  getById(invitationId: string): Promise<WorkspaceInvitationRecord | undefined>;
  getByTokenHash(tokenHash: string): Promise<WorkspaceInvitationRecord | undefined>;
  getPendingByWorkspaceAndEmail(
    workspaceId: string,
    email: string
  ): Promise<WorkspaceInvitationRecord | undefined>;
  findUserIdByEmail(email: string): Promise<string | undefined>;
  create(input: PersistCreateInvitationInput): Promise<void>;
  updateTokenAndExpiry(invitationId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  markAccepted(invitationId: string, acceptedAt: Date): Promise<void>;
  markRevoked(invitationId: string, revokedAt: Date): Promise<void>;
  markExpired(invitationId: string): Promise<void>;
  listPendingByWorkspace(workspaceId: string): Promise<WorkspaceInvitationRecord[]>;
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

function defaultInvitationExpiry(now = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

function buildAcceptUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/workspace-invite/${token}`;
}

function toSummary(record: WorkspaceInvitationRecord): WorkspaceInvitationSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    email: record.email,
    role: record.role,
    invitedByUserId: record.invitedByUserId,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt
  };
}

function isInvitationExpired(record: WorkspaceInvitationRecord, now = new Date()): boolean {
  return record.expiresAt < now;
}

export class InvitationService {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly access: WorkspaceAccess,
    private readonly appUrl: string,
    private readonly audit?: WorkspaceAuditSink
  ) {}

  async createInvitation(
    workspaceId: string,
    email: string,
    role: InvitableWorkspaceRole,
    principal: Principal
  ): Promise<CreatedWorkspaceInvitation> {
    if (principal.type !== "user") {
      throw new WorkspaceForbiddenError("Only signed-in users can invite workspace members.");
    }

    const parsed = createWorkspaceInvitationInputSchema.parse({ email, role });
    const normalizedEmail = normalizeInvitationEmail(parsed.email);

    const workspace = await this.workspaceRepository.getById(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError();
    }

    await this.access.assertAuthorized({
      principal,
      action: "workspace.manage_members",
      context: { workspaceId }
    });

    const existingUserId = await this.invitationRepository.findUserIdByEmail(normalizedEmail);
    if (existingUserId) {
      const membership = await this.workspaceRepository.getMembership(workspaceId, existingUserId);
      if (membership) {
        throw new WorkspaceInvitationConflictError("That user is already a workspace member.");
      }
    }

    const pendingInvitation = await this.invitationRepository.getPendingByWorkspaceAndEmail(
      workspaceId,
      normalizedEmail
    );
    if (pendingInvitation) {
      throw new WorkspaceInvitationConflictError("A pending invitation already exists for that email.");
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashInvitationToken(token);
    const invitationId = randomUUID();
    const expiresAt = defaultInvitationExpiry();

    await this.invitationRepository.create({
      id: invitationId,
      workspaceId,
      email: normalizedEmail,
      role: parsed.role,
      tokenHash,
      invitedByUserId: principal.id,
      expiresAt
    });

    await this.recordAudit(workspaceId, principal, "workspace.invitation_created", "workspace_invitation", invitationId, {
      email: normalizedEmail,
      role: parsed.role
    });

    return {
      id: invitationId,
      workspaceId,
      email: normalizedEmail,
      role: parsed.role,
      acceptUrl: buildAcceptUrl(this.appUrl, token),
      expiresAt: expiresAt.toISOString()
    };
  }

  async acceptInvitation(
    token: string,
    principal: Principal
  ): Promise<{ workspaceId: string; role: WorkspaceRole }> {
    if (principal.type !== "user") {
      throw new WorkspaceForbiddenError("Only signed-in users can accept workspace invitations.");
    }

    if (!principal.email) {
      throw new WorkspaceForbiddenError("A verified email address is required to accept invitations.");
    }

    const invitation = await this.invitationRepository.getByTokenHash(hashInvitationToken(token));
    if (!invitation || invitation.state !== "pending") {
      throw new WorkspaceInvitationNotFoundError("Workspace invitation not found or no longer valid.");
    }

    if (isInvitationExpired(invitation)) {
      await this.invitationRepository.markExpired(invitation.id);
      throw new WorkspaceInvitationExpiredError();
    }

    const normalizedEmail = normalizeInvitationEmail(principal.email);
    if (normalizedEmail !== invitation.email) {
      throw new WorkspaceForbiddenError("This invitation was sent to a different email address.");
    }

    const existingMembership = await this.workspaceRepository.getMembership(invitation.workspaceId, principal.id);
    if (existingMembership) {
      await this.invitationRepository.markAccepted(invitation.id, new Date());
      return { workspaceId: invitation.workspaceId, role: existingMembership.role };
    }

    await this.workspaceRepository.addMember({
      id: randomUUID(),
      workspaceId: invitation.workspaceId,
      userId: principal.id,
      role: invitation.role
    });

    await this.invitationRepository.markAccepted(invitation.id, new Date());
    await this.recordAudit(
      invitation.workspaceId,
      principal,
      "workspace.invitation_accepted",
      "workspace_invitation",
      invitation.id,
      {
        email: invitation.email,
        role: invitation.role,
        memberUserId: principal.id
      }
    );

    return { workspaceId: invitation.workspaceId, role: invitation.role };
  }

  async revokeInvitation(invitationId: string, principal: Principal): Promise<void> {
    const invitation = await this.getManageableInvitation(invitationId, principal);

    if (invitation.state !== "pending") {
      throw new WorkspaceInvitationConflictError("Only pending invitations can be revoked.");
    }

    await this.invitationRepository.markRevoked(invitationId, new Date());
    await this.recordAudit(
      invitation.workspaceId,
      principal,
      "workspace.invitation_revoked",
      "workspace_invitation",
      invitation.id,
      {
        email: invitation.email,
        role: invitation.role
      }
    );
  }

  async resendInvitation(invitationId: string, principal: Principal): Promise<ResentWorkspaceInvitation> {
    const invitation = await this.getManageableInvitation(invitationId, principal);

    if (invitation.state !== "pending") {
      throw new WorkspaceInvitationConflictError("Only pending invitations can be resent.");
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashInvitationToken(token);
    const expiresAt = defaultInvitationExpiry();

    await this.invitationRepository.updateTokenAndExpiry(invitationId, tokenHash, expiresAt);
    await this.recordAudit(
      invitation.workspaceId,
      principal,
      "workspace.invitation_resent",
      "workspace_invitation",
      invitation.id,
      {
        email: invitation.email,
        role: invitation.role,
        expiresAt: expiresAt.toISOString()
      }
    );

    return {
      id: invitationId,
      acceptUrl: buildAcceptUrl(this.appUrl, token),
      expiresAt: expiresAt.toISOString()
    };
  }

  async listPendingInvitations(
    workspaceId: string,
    principal: Principal
  ): Promise<WorkspaceInvitationSummary[]> {
    const workspace = await this.workspaceRepository.getById(workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError();
    }

    await this.access.assertAuthorized({
      principal,
      action: "workspace.manage_members",
      context: { workspaceId }
    });

    const invitations = await this.invitationRepository.listPendingByWorkspace(workspaceId);
    const now = new Date();

    return invitations
      .filter((invitation) => !isInvitationExpired(invitation, now))
      .map(toSummary);
  }

  private async getManageableInvitation(
    invitationId: string,
    principal: Principal
  ): Promise<WorkspaceInvitationRecord> {
    const invitation = await this.invitationRepository.getById(invitationId);
    if (!invitation) {
      throw new WorkspaceInvitationNotFoundError();
    }

    await this.access.assertAuthorized({
      principal,
      action: "workspace.manage_members",
      context: { workspaceId: invitation.workspaceId }
    });

    return invitation;
  }

  private async recordAudit(
    workspaceId: string,
    principal: Principal,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.audit?.record({
      ownerUserId: auditOwnerUserId(principal),
      workspaceId,
      actorPrincipalType: principal.type,
      actorPrincipalId: principal.id,
      action,
      targetType,
      targetId,
      metadata
    });
  }
}

export class DrizzleInvitationRepository implements InvitationRepository {
  constructor(private readonly db: Database) {}

  async getById(invitationId: string): Promise<WorkspaceInvitationRecord | undefined> {
    const [invitation] = await this.db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.id, invitationId))
      .limit(1);

    return invitation ? this.toRecord(invitation) : undefined;
  }

  async getByTokenHash(tokenHash: string): Promise<WorkspaceInvitationRecord | undefined> {
    const [invitation] = await this.db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.tokenHash, tokenHash))
      .limit(1);

    return invitation ? this.toRecord(invitation) : undefined;
  }

  async getPendingByWorkspaceAndEmail(
    workspaceId: string,
    email: string
  ): Promise<WorkspaceInvitationRecord | undefined> {
    const [invitation] = await this.db
      .select()
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          eq(workspaceInvitations.state, "pending"),
          sql`lower(${workspaceInvitations.email}) = ${email}`
        )
      )
      .limit(1);

    return invitation ? this.toRecord(invitation) : undefined;
  }

  async findUserIdByEmail(email: string): Promise<string | undefined> {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    return user?.id;
  }

  async create(input: PersistCreateInvitationInput): Promise<void> {
    await this.db.insert(workspaceInvitations).values({
      id: input.id,
      workspaceId: input.workspaceId,
      email: input.email,
      role: input.role,
      tokenHash: input.tokenHash,
      invitedByUserId: input.invitedByUserId,
      state: "pending",
      expiresAt: input.expiresAt,
      createdAt: new Date()
    });
  }

  async updateTokenAndExpiry(invitationId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db
      .update(workspaceInvitations)
      .set({ tokenHash, expiresAt })
      .where(eq(workspaceInvitations.id, invitationId));
  }

  async markAccepted(invitationId: string, acceptedAt: Date): Promise<void> {
    await this.db
      .update(workspaceInvitations)
      .set({ state: "accepted", acceptedAt })
      .where(eq(workspaceInvitations.id, invitationId));
  }

  async markRevoked(invitationId: string, revokedAt: Date): Promise<void> {
    await this.db
      .update(workspaceInvitations)
      .set({ state: "revoked", revokedAt })
      .where(eq(workspaceInvitations.id, invitationId));
  }

  async markExpired(invitationId: string): Promise<void> {
    await this.db
      .update(workspaceInvitations)
      .set({ state: "expired" })
      .where(eq(workspaceInvitations.id, invitationId));
  }

  async listPendingByWorkspace(workspaceId: string): Promise<WorkspaceInvitationRecord[]> {
    const rows = await this.db
      .select()
      .from(workspaceInvitations)
      .where(and(eq(workspaceInvitations.workspaceId, workspaceId), eq(workspaceInvitations.state, "pending")));

    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: typeof workspaceInvitations.$inferSelect): WorkspaceInvitationRecord {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      email: row.email,
      role: row.role,
      tokenHash: row.tokenHash,
      invitedByUserId: row.invitedByUserId,
      state: row.state,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt
    };
  }
}

export class MemoryInvitationRepository implements InvitationRepository {
  private readonly invitations = new Map<string, WorkspaceInvitationRecord>();
  private readonly usersByEmail = new Map<string, string>();

  setUserEmail(userId: string, email: string): void {
    this.usersByEmail.set(normalizeInvitationEmail(email), userId);
  }

  async getById(invitationId: string): Promise<WorkspaceInvitationRecord | undefined> {
    return this.invitations.get(invitationId);
  }

  async getByTokenHash(tokenHash: string): Promise<WorkspaceInvitationRecord | undefined> {
    return [...this.invitations.values()].find((invitation) => invitation.tokenHash === tokenHash);
  }

  async getPendingByWorkspaceAndEmail(
    workspaceId: string,
    email: string
  ): Promise<WorkspaceInvitationRecord | undefined> {
    return [...this.invitations.values()].find(
      (invitation) =>
        invitation.workspaceId === workspaceId &&
        invitation.state === "pending" &&
        invitation.email === email
    );
  }

  async findUserIdByEmail(email: string): Promise<string | undefined> {
    return this.usersByEmail.get(email);
  }

  async create(input: PersistCreateInvitationInput): Promise<void> {
    this.invitations.set(input.id, {
      id: input.id,
      workspaceId: input.workspaceId,
      email: input.email,
      role: input.role,
      tokenHash: input.tokenHash,
      invitedByUserId: input.invitedByUserId,
      state: "pending",
      expiresAt: input.expiresAt,
      acceptedAt: null,
      revokedAt: null,
      createdAt: new Date()
    });
  }

  async updateTokenAndExpiry(invitationId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) {
      return;
    }

    this.invitations.set(invitationId, { ...invitation, tokenHash, expiresAt });
  }

  async markAccepted(invitationId: string, acceptedAt: Date): Promise<void> {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) {
      return;
    }

    this.invitations.set(invitationId, { ...invitation, state: "accepted", acceptedAt });
  }

  async markRevoked(invitationId: string, revokedAt: Date): Promise<void> {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) {
      return;
    }

    this.invitations.set(invitationId, { ...invitation, state: "revoked", revokedAt });
  }

  async markExpired(invitationId: string): Promise<void> {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) {
      return;
    }

    this.invitations.set(invitationId, { ...invitation, state: "expired" });
  }

  async listPendingByWorkspace(workspaceId: string): Promise<WorkspaceInvitationRecord[]> {
    return [...this.invitations.values()].filter(
      (invitation) => invitation.workspaceId === workspaceId && invitation.state === "pending"
    );
  }
}

export function createDrizzleInvitationService(db: Database, appUrl: string): InvitationService {
  const workspaceRepository = new DrizzleWorkspaceRepository(db);
  const access = createWorkspaceAccess(new DrizzleWorkspaceRoleResolver(workspaceRepository));
  return new InvitationService(
    new DrizzleInvitationRepository(db),
    workspaceRepository,
    access,
    appUrl,
    new DrizzleWorkspaceAuditSink(db)
  );
}
