import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import {
  artifactVersions,
  artifacts,
  billingAccounts,
  billingUsageEvents,
  billingWebhookEvents,
  projects
} from "@agent-artifacts/db";

export const FREE_PLAN_ID = "free";

export type BillingPlanId = "free" | "builder" | "studio";
export type BillingSubscriptionStatus =
  | "active"
  | "trialing"
  | "on_hold"
  | "cancelled"
  | "expired"
  | "failed";

export type BillingUsageMeterName = "artifact.storage_gb_days" | "artifact.delivery_gb" | "artifact.version_write";

export interface BillingEntitlements {
  maxProjects: number | null;
  maxActiveArtifacts: number | null;
  maxContentBytes: number;
  includedStorageBytes: number;
  includedDeliveryBytes: number;
  includedVersionWrites: number;
  includedSeats: number;
  privateArtifacts: boolean;
  emailAllowlist: boolean;
  shareLinks: boolean;
  publicEditLinks: boolean;
  overageBilling: boolean;
  auditRetentionDays: number;
  versionHistoryDays: number;
}

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  displayName: string;
  monthlyPriceUsd: number;
  description: string;
  entitlements: BillingEntitlements;
}

export const BILLING_PLANS = {
  free: {
    id: "free",
    name: "Free",
    displayName: "Builder",
    monthlyPriceUsd: 0,
    description: "Public artifact hosting for trying Artifacts.",
    entitlements: {
      maxProjects: 3,
      maxActiveArtifacts: 25,
      maxContentBytes: 1 * 1024 * 1024,
      includedStorageBytes: 100 * 1024 * 1024,
      includedDeliveryBytes: 0,
      includedVersionWrites: 100,
      includedSeats: 1,
      privateArtifacts: false,
      emailAllowlist: false,
      shareLinks: false,
      publicEditLinks: false,
      overageBilling: false,
      auditRetentionDays: 7,
      versionHistoryDays: 30
    }
  },
  builder: {
    id: "builder",
    name: "Builder",
    displayName: "Pro",
    monthlyPriceUsd: 3,
    description: "Private artifacts, longer history, and higher automation limits for solo builders.",
    entitlements: {
      maxProjects: null,
      maxActiveArtifacts: null,
      maxContentBytes: 10 * 1024 * 1024,
      includedStorageBytes: 5 * 1024 * 1024 * 1024,
      includedDeliveryBytes: 50 * 1024 * 1024 * 1024,
      includedVersionWrites: 2_000,
      includedSeats: 1,
      privateArtifacts: true,
      emailAllowlist: true,
      shareLinks: true,
      publicEditLinks: true,
      overageBilling: true,
      auditRetentionDays: 90,
      versionHistoryDays: 365
    }
  },
  studio: {
    id: "studio",
    name: "Studio",
    displayName: "Team",
    monthlyPriceUsd: 12,
    description: "Shared workspace billing and collaboration for teams.",
    entitlements: {
      maxProjects: null,
      maxActiveArtifacts: null,
      maxContentBytes: 50 * 1024 * 1024,
      includedStorageBytes: 50 * 1024 * 1024 * 1024,
      includedDeliveryBytes: 250 * 1024 * 1024 * 1024,
      includedVersionWrites: 10_000,
      includedSeats: 3,
      privateArtifacts: true,
      emailAllowlist: true,
      shareLinks: true,
      publicEditLinks: true,
      overageBilling: true,
      auditRetentionDays: 365,
      versionHistoryDays: 365
    }
  }
} satisfies Record<BillingPlanId, BillingPlan>;

export const DODO_PRODUCT_CONFIG = {
  builder: {
    planId: "builder",
    monthlyPriceUsd: 3,
    includedSeats: 1
  },
  studio: {
    planId: "studio",
    monthlyPriceUsd: 12,
    includedSeats: 3,
    additionalSeatPriceUsd: 3
  }
} as const;

export const DODO_USAGE_METERS: Array<{
  eventName: BillingUsageMeterName;
  aggregation: "sum" | "count";
  unit: string;
  overagePriceUsd: number;
  builderIncluded: number;
  studioIncluded: number;
}> = [
  {
    eventName: "artifact.storage_gb_days",
    aggregation: "sum",
    unit: "GB-days",
    overagePriceUsd: 0.10 / 30,
    builderIncluded: 5 * 30,
    studioIncluded: 50 * 30
  },
  {
    eventName: "artifact.delivery_gb",
    aggregation: "sum",
    unit: "GB",
    overagePriceUsd: 0.05,
    builderIncluded: 50,
    studioIncluded: 250
  },
  {
    eventName: "artifact.version_write",
    aggregation: "count",
    unit: "writes",
    overagePriceUsd: 0.20 / 1000,
    builderIncluded: 2_000,
    studioIncluded: 10_000
  }
];

export interface BillingAccount {
  userId: string;
  planId: BillingPlanId;
  status: string;
  dodoCustomerId: string | null;
  dodoSubscriptionId?: string | null;
  dodoProductId?: string | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

export interface BillingUsageSnapshot {
  projects: number;
  activeArtifacts: number;
  storageBytes: number;
  versionWritesThisMonth: number;
  deliveryBytesThisMonth: number;
}

export interface BillingRepository {
  getAccount(userId: string): Promise<BillingAccount | undefined>;
  getAccountByDodoSubscriptionId(subscriptionId: string): Promise<BillingAccount | undefined>;
  getAccountByDodoCustomerId(customerId: string): Promise<BillingAccount | undefined>;
  upsertAccount(account: BillingAccount): Promise<void>;
  upsertAccountForWebhook?(eventId: string, eventType: string, account: BillingAccount): Promise<boolean>;
  hasProcessedWebhook(eventId: string): Promise<boolean>;
  markWebhookProcessed(eventId: string, eventType?: string): Promise<void>;
  getUsage(userId: string): Promise<BillingUsageSnapshot>;
  listBillableOwnerIds(): Promise<string[]>;
  recordUsageEvent?(event: {
    id: string;
    ownerUserId: string;
    meter: BillingUsageMeterName;
    quantity: number;
    dodoEventId: string;
    metadata: Record<string, string>;
  }): Promise<void>;
}

export interface BillingGateway {
  createCheckoutSession(input: Record<string, unknown>): Promise<{ checkoutUrl: string; sessionId: string }>;
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  ingestUsageEvent(event: {
    customerId: string;
    eventName: BillingUsageMeterName;
    eventId: string;
    quantity: number;
    metadata: Record<string, string>;
  }): Promise<void>;
}

export interface ResolvedEntitlements {
  plan: BillingPlan;
  account?: BillingAccount | { planId: BillingPlanId; status: string };
}

export class EntitlementLimitError extends Error {
  readonly limit?: string;
  readonly requiredPlanId?: BillingPlanId;

  constructor(message: string, options: { limit?: string; requiredPlanId?: BillingPlanId } = {}) {
    super(message);
    this.name = "EntitlementLimitError";
    this.limit = options.limit;
    this.requiredPlanId = options.requiredPlanId;
  }
}

function displayNameForPlan(planId: BillingPlanId): string {
  return BILLING_PLANS[planId].displayName;
}

function nextPaidPlanId(planId: BillingPlanId): BillingPlanId | undefined {
  switch (planId) {
    case "free":
      return "builder";
    case "builder":
      return "studio";
    case "studio":
      return undefined;
    default: {
      const _exhaustive: never = planId;
      return _exhaustive;
    }
  }
}

export function resolveEntitlements(account: BillingAccount | { planId: BillingPlanId; status: string } | undefined): ResolvedEntitlements {
  if (!account || !isPaidStatus(account.status)) {
    return { plan: BILLING_PLANS.free };
  }

  return {
    plan: BILLING_PLANS[account.planId] ?? BILLING_PLANS.free,
    account
  };
}

export function createCheckoutSessionInput(input: {
  planId: Exclude<BillingPlanId, "free">;
  productId: string;
  user: { id: string; email: string; name?: string | null };
  returnUrl: string;
}) {
  return {
    product_cart: [{ product_id: input.productId, quantity: 1 }],
    customer: {
      email: input.user.email,
      name: input.user.name ?? undefined
    },
    metadata: {
      user_id: input.user.id,
      plan_id: input.planId
    },
    return_url: input.returnUrl
  };
}

export function verifyDodoWebhookSignature(input: {
  payload: string;
  signature: string;
  timestamp: string;
  secret: string;
  now?: number;
  toleranceMs?: number;
}): boolean {
  const eventTime = Number.parseInt(input.timestamp, 10) * 1000;
  if (!Number.isFinite(eventTime)) return false;
  if (Math.abs((input.now ?? Date.now()) - eventTime) > (input.toleranceMs ?? 5 * 60_000)) {
    return false;
  }

  const provided = input.signature.split(",")[1] ?? "";
  if (!provided) return false;

  const expected = createHmac("sha256", input.secret).update(`${input.timestamp}.${input.payload}`).digest("base64");
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (expectedBytes.byteLength !== providedBytes.byteLength) return false;

  return timingSafeEqual(expectedBytes, providedBytes);
}

export class BillingService {
  constructor(
    private readonly repository: BillingRepository,
    private readonly gateway: BillingGateway
  ) {}

  async getAccountEntitlements(userId: string): Promise<ResolvedEntitlements> {
    return resolveEntitlements(await this.repository.getAccount(userId));
  }

  async getUsage(userId: string): Promise<BillingUsageSnapshot> {
    return this.repository.getUsage(userId);
  }

  async createCheckoutSession(input: {
    planId: Exclude<BillingPlanId, "free">;
    productId: string;
    user: { id: string; email: string; name?: string | null };
    returnUrl: string;
  }) {
    return this.gateway.createCheckoutSession(createCheckoutSessionInput(input));
  }

  async createPortalSession(input: { userId: string; returnUrl: string }) {
    const account = await this.repository.getAccount(input.userId);
    if (!account?.dodoCustomerId) {
      throw new EntitlementLimitError("No paid billing customer is linked to this account.", {
        limit: "billing_customer_required",
        requiredPlanId: "builder"
      });
    }

    return this.gateway.createPortalSession({ customerId: account.dodoCustomerId, returnUrl: input.returnUrl });
  }

  async handleDodoSubscriptionEvent(
    event: {
      eventId: string;
      type: string;
      data: {
        subscription_id?: string;
        product_id?: string;
        customer?: { customer_id?: string; email?: string };
        metadata?: Record<string, string | undefined>;
        next_billing_date?: string;
        cancel_at_next_billing_date?: boolean;
      };
    },
    products: { builderProductId?: string; studioProductId?: string }
  ): Promise<void> {
    const existingAccount = await this.findExistingDodoAccount({
      subscriptionId: event.data.subscription_id,
      customerId: event.data.customer?.customer_id
    });
    const userId = event.data.metadata?.user_id ?? existingAccount?.userId;
    if (!userId) {
      throw new Error("Dodo subscription webhook is missing metadata.user_id and could not be reconciled.");
    }

    const planId = event.data.product_id ? planIdForProduct(event.data.product_id, products) : existingAccount?.planId;
    if (!planId || planId === "free") {
      throw new Error("Dodo subscription webhook could not be mapped to a paid plan.");
    }
    const status = statusForDodoEvent(event.type, event.data.cancel_at_next_billing_date);
    const account = {
      userId,
      planId,
      status,
      dodoCustomerId: event.data.customer?.customer_id ?? null,
      dodoSubscriptionId: event.data.subscription_id ?? null,
      dodoProductId: event.data.product_id ?? null,
      currentPeriodEnd: event.data.next_billing_date ? new Date(event.data.next_billing_date) : null,
      cancelAtPeriodEnd: event.data.cancel_at_next_billing_date ?? false
    };

    if (this.repository.upsertAccountForWebhook) {
      await this.repository.upsertAccountForWebhook(event.eventId, event.type, account);
      return;
    }

    if (await this.repository.hasProcessedWebhook(event.eventId)) return;
    await this.repository.upsertAccount(account);
    await this.repository.markWebhookProcessed(event.eventId, event.type);
  }

  private async findExistingDodoAccount(input: { subscriptionId?: string; customerId?: string }): Promise<BillingAccount | undefined> {
    if (input.subscriptionId) {
      const account = await this.repository.getAccountByDodoSubscriptionId(input.subscriptionId);
      if (account) return account;
    }
    if (input.customerId) {
      return this.repository.getAccountByDodoCustomerId(input.customerId);
    }
    return undefined;
  }

  async trackUsage(input: {
    ownerUserId: string;
    meter: BillingUsageMeterName;
    quantity: number;
    idempotencyKey: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
    const account = await this.repository.getAccount(input.ownerUserId);
    const { plan } = resolveEntitlements(account);
    if (!plan.entitlements.overageBilling || !account?.dodoCustomerId) return;

    const event = {
      customerId: account.dodoCustomerId,
      eventName: input.meter,
      eventId: `${input.meter}:${input.idempotencyKey}`,
      quantity: input.quantity,
      metadata: {
        ...(input.metadata ?? {}),
        quantity: String(input.quantity)
      }
    };

    await this.gateway.ingestUsageEvent(event);
    await this.repository.recordUsageEvent?.({
      id: event.eventId,
      ownerUserId: input.ownerUserId,
      meter: input.meter,
      quantity: input.quantity,
      dodoEventId: event.eventId,
      metadata: event.metadata
    });
  }

  async recordVersionWrite(input: {
    ownerUserId: string;
    artifactId: string;
    versionNumber: number;
    contentBytes: number;
  }): Promise<void> {
    await this.trackUsage({
      ownerUserId: input.ownerUserId,
      meter: "artifact.version_write",
      quantity: 1,
      idempotencyKey: `${input.artifactId}:v${input.versionNumber}`,
      metadata: {
        artifact_id: input.artifactId,
        version_number: String(input.versionNumber),
        content_bytes: String(input.contentBytes)
      }
    });
  }

  async recordDelivery(input: {
    ownerUserId: string;
    artifactId: string;
    versionNumber: number;
    contentBytes: number;
  }): Promise<void> {
    await this.trackUsage({
      ownerUserId: input.ownerUserId,
      meter: "artifact.delivery_gb",
      quantity: input.contentBytes / (1024 * 1024 * 1024),
      idempotencyKey: `${input.artifactId}:v${input.versionNumber}:delivery:${randomUUID()}`,
      metadata: {
        artifact_id: input.artifactId,
        version_number: String(input.versionNumber),
        content_bytes: String(input.contentBytes)
      }
    });
  }

  async recordStorageSnapshot(ownerUserId: string, snapshotDate = new Date()): Promise<void> {
    const usage = await this.repository.getUsage(ownerUserId);
    const day = snapshotDate.toISOString().slice(0, 10);
    await this.trackUsage({
      ownerUserId,
      meter: "artifact.storage_gb_days",
      quantity: usage.storageBytes / (1024 * 1024 * 1024),
      idempotencyKey: `${ownerUserId}:${day}`,
      metadata: {
        snapshot_date: day,
        storage_bytes: String(usage.storageBytes)
      }
    });
  }

  async recordStorageSnapshotsForActiveAccounts(snapshotDate = new Date()): Promise<void> {
    const ownerIds = await this.repository.listBillableOwnerIds();
    for (const ownerUserId of ownerIds) {
      await this.recordStorageSnapshot(ownerUserId, snapshotDate);
    }
  }

  async assertCanCreateProject(ownerUserId: string): Promise<void> {
    const [resolved, usage] = await Promise.all([
      this.getAccountEntitlements(ownerUserId),
      this.repository.getUsage(ownerUserId)
    ]);
    const maxProjects = resolved.plan.entitlements.maxProjects;
    if (maxProjects !== null && usage.projects >= maxProjects) {
      const requiredPlanId = nextPaidPlanId(resolved.plan.id);
      throw new EntitlementLimitError(
        `${resolved.plan.displayName} includes ${maxProjects} projects. Upgrade${requiredPlanId ? ` to ${displayNameForPlan(requiredPlanId)}` : ""} to create more.`,
        { limit: "max_projects", requiredPlanId }
      );
    }
  }

  async assertCanCreateArtifact(
    ownerUserId: string,
    input: { publicView: boolean; publicEdit: boolean; contentBytes: number }
  ): Promise<void> {
    const [resolved, usage] = await Promise.all([
      this.getAccountEntitlements(ownerUserId),
      this.repository.getUsage(ownerUserId)
    ]);
    this.assertAccessEntitlements(resolved.plan, input);
    this.assertContentEntitlement(resolved.plan, input.contentBytes);

    const maxActiveArtifacts = resolved.plan.entitlements.maxActiveArtifacts;
    if (maxActiveArtifacts !== null && usage.activeArtifacts >= maxActiveArtifacts) {
      const requiredPlanId = nextPaidPlanId(resolved.plan.id);
      throw new EntitlementLimitError(
        `${resolved.plan.displayName} includes ${maxActiveArtifacts} active artifacts. Upgrade${requiredPlanId ? ` to ${displayNameForPlan(requiredPlanId)}` : ""} to create more.`,
        { limit: "max_active_artifacts", requiredPlanId }
      );
    }
    this.assertStorageEntitlement(resolved.plan, usage.storageBytes + input.contentBytes);
  }

  async assertCanWriteVersion(ownerUserId: string, input: { contentBytes: number }): Promise<void> {
    const [resolved, usage] = await Promise.all([
      this.getAccountEntitlements(ownerUserId),
      this.repository.getUsage(ownerUserId)
    ]);
    this.assertContentEntitlement(resolved.plan, input.contentBytes);
    if (!resolved.plan.entitlements.overageBilling && usage.versionWritesThisMonth >= resolved.plan.entitlements.includedVersionWrites) {
      const requiredPlanId = nextPaidPlanId(resolved.plan.id);
      throw new EntitlementLimitError(
        `${resolved.plan.displayName} includes ${resolved.plan.entitlements.includedVersionWrites} version writes per month. Upgrade${requiredPlanId ? ` to ${displayNameForPlan(requiredPlanId)}` : ""} for more.`,
        { limit: "included_version_writes", requiredPlanId }
      );
    }
    this.assertStorageEntitlement(resolved.plan, usage.storageBytes + input.contentBytes);
  }

  async assertCanSetArtifactAccess(
    ownerUserId: string,
    input: { publicView: boolean; publicEdit: boolean; viewerEmails: string[] }
  ): Promise<void> {
    const resolved = await this.getAccountEntitlements(ownerUserId);
    this.assertAccessEntitlements(resolved.plan, input);
    if (input.viewerEmails.length > 0 && !resolved.plan.entitlements.emailAllowlist) {
      throw new EntitlementLimitError("Email allowlists require Pro.", {
        limit: "email_allowlist",
        requiredPlanId: "builder"
      });
    }
  }

  private assertAccessEntitlements(plan: BillingPlan, input: { publicView: boolean; publicEdit: boolean }) {
    if (!input.publicView && !plan.entitlements.privateArtifacts) {
      throw new EntitlementLimitError("Private artifacts require Pro.", {
        limit: "private_artifacts",
        requiredPlanId: "builder"
      });
    }
    if (input.publicEdit && !plan.entitlements.publicEditLinks) {
      throw new EntitlementLimitError("Public edit links require Pro.", {
        limit: "public_edit_links",
        requiredPlanId: "builder"
      });
    }
  }

  private assertContentEntitlement(plan: BillingPlan, contentBytes: number) {
    if (contentBytes > plan.entitlements.maxContentBytes) {
      const requiredPlanId = nextPaidPlanId(plan.id);
      throw new EntitlementLimitError(
        `Content size ${contentBytes} bytes exceeds ${plan.displayName} limit of ${plan.entitlements.maxContentBytes} bytes.`,
        { limit: "max_content_bytes", requiredPlanId }
      );
    }
  }

  private assertStorageEntitlement(plan: BillingPlan, projectedStorageBytes: number) {
    if (!plan.entitlements.overageBilling && projectedStorageBytes > plan.entitlements.includedStorageBytes) {
      const requiredPlanId = nextPaidPlanId(plan.id);
      throw new EntitlementLimitError(
        `${plan.displayName} includes ${plan.entitlements.includedStorageBytes} stored bytes. Upgrade${requiredPlanId ? ` to ${displayNameForPlan(requiredPlanId)}` : ""} for more storage.`,
        { limit: "included_storage_bytes", requiredPlanId }
      );
    }
  }
}

function planIdForProduct(
  productId: string | undefined,
  products: { builderProductId?: string; studioProductId?: string }
): Exclude<BillingPlanId, "free"> {
  if (!productId) {
    throw new Error("Dodo subscription webhook is missing product_id.");
  }
  if (productId && productId === products.studioProductId) return "studio";
  if (productId && productId === products.builderProductId) return "builder";
  throw new Error(`Unknown Dodo product "${productId}".`);
}

function statusForDodoEvent(eventType: string, cancelAtPeriodEnd = false): BillingSubscriptionStatus {
  switch (eventType) {
    case "subscription.on_hold":
      return "on_hold";
    case "subscription.cancelled":
      if (cancelAtPeriodEnd) return "active";
      return "cancelled";
    case "subscription.expired":
      return "expired";
    case "subscription.failed":
      return "failed";
    default:
      return "active";
  }
}

function isPaidStatus(status: string): boolean {
  return status === "active" || status === "trialing";
}

export class DrizzleBillingRepository implements BillingRepository {
  constructor(private readonly db: Database) {}

  async getAccount(userId: string): Promise<BillingAccount | undefined> {
    const [account] = await this.db.select().from(billingAccounts).where(eq(billingAccounts.userId, userId)).limit(1);
    return account ? this.toAccount(account) : undefined;
  }

  async getAccountByDodoSubscriptionId(subscriptionId: string): Promise<BillingAccount | undefined> {
    const [account] = await this.db
      .select()
      .from(billingAccounts)
      .where(eq(billingAccounts.dodoSubscriptionId, subscriptionId))
      .limit(1);
    return account ? this.toAccount(account) : undefined;
  }

  async getAccountByDodoCustomerId(customerId: string): Promise<BillingAccount | undefined> {
    const [account] = await this.db
      .select()
      .from(billingAccounts)
      .where(eq(billingAccounts.dodoCustomerId, customerId))
      .limit(1);
    return account ? this.toAccount(account) : undefined;
  }

  async upsertAccount(account: BillingAccount): Promise<void> {
    await this.db
      .insert(billingAccounts)
      .values({
        userId: account.userId,
        planId: account.planId,
        status: account.status as BillingSubscriptionStatus,
        dodoCustomerId: account.dodoCustomerId,
        dodoSubscriptionId: account.dodoSubscriptionId,
        dodoProductId: account.dodoProductId,
        currentPeriodEnd: account.currentPeriodEnd,
        cancelAtPeriodEnd: account.cancelAtPeriodEnd ?? false,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: billingAccounts.userId,
        set: {
          planId: account.planId,
          status: account.status as BillingSubscriptionStatus,
          dodoCustomerId: account.dodoCustomerId,
          dodoSubscriptionId: account.dodoSubscriptionId,
          dodoProductId: account.dodoProductId,
          currentPeriodEnd: account.currentPeriodEnd,
          cancelAtPeriodEnd: account.cancelAtPeriodEnd ?? false,
          updatedAt: new Date()
        }
      });
  }

  async hasProcessedWebhook(eventId: string): Promise<boolean> {
    const [event] = await this.db.select({ id: billingWebhookEvents.id }).from(billingWebhookEvents).where(eq(billingWebhookEvents.id, eventId)).limit(1);
    return event !== undefined;
  }

  async markWebhookProcessed(eventId: string, eventType = "unknown"): Promise<void> {
    await this.db.insert(billingWebhookEvents).values({ id: eventId, eventType }).onConflictDoNothing();
  }

  async upsertAccountForWebhook(eventId: string, eventType: string, account: BillingAccount): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const claimed = await tx
        .insert(billingWebhookEvents)
        .values({ id: eventId, eventType })
        .onConflictDoNothing()
        .returning({ id: billingWebhookEvents.id });

      if (claimed.length === 0) {
        return false;
      }

      await tx
        .insert(billingAccounts)
        .values({
          userId: account.userId,
          planId: account.planId,
          status: account.status as BillingSubscriptionStatus,
          dodoCustomerId: account.dodoCustomerId,
          dodoSubscriptionId: account.dodoSubscriptionId,
          dodoProductId: account.dodoProductId,
          currentPeriodEnd: account.currentPeriodEnd,
          cancelAtPeriodEnd: account.cancelAtPeriodEnd ?? false,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: billingAccounts.userId,
          set: {
            planId: account.planId,
            status: account.status as BillingSubscriptionStatus,
            dodoCustomerId: account.dodoCustomerId,
            dodoSubscriptionId: account.dodoSubscriptionId,
            dodoProductId: account.dodoProductId,
            currentPeriodEnd: account.currentPeriodEnd,
            cancelAtPeriodEnd: account.cancelAtPeriodEnd ?? false,
            updatedAt: new Date()
          }
        });
      return true;
    });
  }

  async getUsage(userId: string): Promise<BillingUsageSnapshot> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [[projectCount], [artifactCount], [storage], [versionWrites], [deliveryGb]] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)::int` }).from(projects).where(eq(projects.ownerUserId, userId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(artifacts)
        .where(and(eq(artifacts.ownerUserId, userId), eq(artifacts.state, "active"))),
      this.db
        .select({ bytes: sql<string>`coalesce(sum(${artifactVersions.contentBytes}), 0)` })
        .from(artifactVersions)
        .innerJoin(artifacts, eq(artifacts.id, artifactVersions.artifactId))
        .where(eq(artifacts.ownerUserId, userId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(artifactVersions)
        .innerJoin(artifacts, eq(artifacts.id, artifactVersions.artifactId))
        .where(and(eq(artifacts.ownerUserId, userId), gte(artifactVersions.createdAt, monthStart))),
      this.db
        .select({ quantity: sql<string>`coalesce(sum(${billingUsageEvents.quantity}), 0)` })
        .from(billingUsageEvents)
        .where(and(eq(billingUsageEvents.ownerUserId, userId), eq(billingUsageEvents.meter, "artifact.delivery_gb"), gte(billingUsageEvents.createdAt, monthStart)))
    ]);

    return {
      projects: Number(projectCount?.count ?? 0),
      activeArtifacts: Number(artifactCount?.count ?? 0),
      storageBytes: Number(storage?.bytes ?? 0),
      versionWritesThisMonth: Number(versionWrites?.count ?? 0),
      deliveryBytesThisMonth: Math.round(Number(deliveryGb?.quantity ?? 0) * 1024 * 1024 * 1024)
    };
  }

  async listBillableOwnerIds(): Promise<string[]> {
    const rows = await this.db
      .select({ userId: billingAccounts.userId })
      .from(billingAccounts)
      .where(
        and(
          sql`${billingAccounts.planId} <> 'free'`,
          sql`${billingAccounts.status} IN ('active', 'trialing')`
        )
      );
    return rows.map((row) => row.userId);
  }

  async recordUsageEvent(event: {
    id: string;
    ownerUserId: string;
    meter: BillingUsageMeterName;
    quantity: number;
    dodoEventId: string;
    metadata: Record<string, string>;
  }): Promise<void> {
    await this.db
      .insert(billingUsageEvents)
      .values({
        id: event.id,
        ownerUserId: event.ownerUserId,
        meter: event.meter,
        quantity: String(event.quantity),
        dodoEventId: event.dodoEventId,
        metadata: event.metadata
      })
      .onConflictDoNothing();
  }

  private toAccount(account: typeof billingAccounts.$inferSelect): BillingAccount {
    return {
      userId: account.userId,
      planId: account.planId,
      status: account.status,
      dodoCustomerId: account.dodoCustomerId,
      dodoSubscriptionId: account.dodoSubscriptionId,
      dodoProductId: account.dodoProductId,
      currentPeriodEnd: account.currentPeriodEnd,
      cancelAtPeriodEnd: account.cancelAtPeriodEnd
    };
  }
}
