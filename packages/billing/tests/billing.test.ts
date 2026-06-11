import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  BILLING_PLANS,
  BillingService,
  type BillingGateway,
  type BillingPlanId,
  type BillingRepository,
  DODO_PRODUCT_CONFIG,
  DODO_USAGE_METERS,
  EntitlementLimitError,
  FREE_PLAN_ID,
  verifyDodoWebhookSignature
} from "../src/index.js";

describe("billing entitlements", () => {
  it("keeps free public and capped while Builder and Studio allow paid collaboration features", () => {
    expect(BILLING_PLANS.free.displayName).toBe("Builder");
    expect(BILLING_PLANS.builder.displayName).toBe("Pro");
    expect(BILLING_PLANS.studio.displayName).toBe("Team");

    expect(BILLING_PLANS.free.entitlements).toMatchObject({
      maxProjects: 3,
      maxActiveArtifacts: 25,
      maxContentBytes: 1_048_576,
      privateArtifacts: false,
      emailAllowlist: false,
      publicEditLinks: false,
      overageBilling: false
    });

    expect(BILLING_PLANS.builder.entitlements).toMatchObject({
      maxProjects: null,
      maxActiveArtifacts: null,
      maxContentBytes: 10 * 1024 * 1024,
      privateArtifacts: true,
      emailAllowlist: true,
      publicEditLinks: true,
      includedStorageBytes: 5 * 1024 * 1024 * 1024
    });

    expect(BILLING_PLANS.studio.entitlements).toMatchObject({
      includedSeats: 3,
      maxContentBytes: 50 * 1024 * 1024,
      includedStorageBytes: 50 * 1024 * 1024 * 1024,
      includedDeliveryBytes: 250 * 1024 * 1024 * 1024
    });
  });

  it("falls back to free entitlements unless a paid subscription is active", async () => {
    const repository = new MemoryBillingRepository();
    const service = new BillingService(repository, new MemoryBillingGateway());

    expect((await service.getAccountEntitlements("missing")).plan.id).toBe(FREE_PLAN_ID);
    repository.accounts.set("paid", {
      userId: "paid",
      planId: "builder",
      status: "active",
      dodoCustomerId: "cus_paid"
    });
    repository.accounts.set("cancelled", {
      userId: "cancelled",
      planId: "builder",
      status: "cancelled",
      dodoCustomerId: "cus_cancelled"
    });

    expect((await service.getAccountEntitlements("paid")).plan.id).toBe("builder");
    expect((await service.getAccountEntitlements("cancelled")).plan.id).toBe(FREE_PLAN_ID);
  });

  it("falls back to free entitlements when the paid period is stale", async () => {
    const repository = new MemoryBillingRepository();
    const service = new BillingService(repository, new MemoryBillingGateway());
    repository.accounts.set("grace", {
      userId: "grace",
      planId: "builder",
      status: "active",
      dodoCustomerId: "cus_grace",
      currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000)
    });
    repository.accounts.set("stale", {
      userId: "stale",
      planId: "builder",
      status: "active",
      dodoCustomerId: "cus_stale",
      currentPeriodEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    });

    expect((await service.getAccountEntitlements("grace")).plan.id).toBe("builder");
    expect((await service.getAccountEntitlements("stale")).plan.id).toBe(FREE_PLAN_ID);
  });
});

describe("Dodo product and meter configuration", () => {
  it("maps paid plans to subscription products and overage meters", () => {
    expect(DODO_PRODUCT_CONFIG.builder).toMatchObject({ monthlyPriceUsd: 3, includedSeats: 1 });
    expect(DODO_PRODUCT_CONFIG.studio).toMatchObject({ monthlyPriceUsd: 12, includedSeats: 3 });
    expect(DODO_USAGE_METERS.map((meter) => meter.eventName)).toEqual([
      "artifact.storage_gb_days",
      "artifact.delivery_gb",
      "artifact.version_write"
    ]);
  });

  it("builds a checkout session request with user metadata and plan product id", async () => {
    const gateway = new MemoryBillingGateway();
    const service = new BillingService(new MemoryBillingRepository(), gateway);

    await service.createCheckoutSession({
      planId: "builder",
      productId: "prod_builder",
      user: { id: "user_1", email: "owner@example.com", name: "Owner" },
      returnUrl: "https://agent-artifacts.com/settings/billing"
    });

    expect(gateway.checkoutInputs[0]).toMatchObject({
      product_cart: [{ product_id: "prod_builder", quantity: 1 }],
      customer: { email: "owner@example.com", name: "Owner" },
      metadata: { user_id: "user_1", plan_id: "builder" },
      return_url: "https://agent-artifacts.com/settings/billing"
    });
  });
});

describe("Dodo webhook verification", () => {
  it("accepts valid signatures and rejects invalid signatures", () => {
    const payload = JSON.stringify({ type: "subscription.active" });
    const timestamp = "1779999999";
    const secret = "whsec_test";
    const signature = sign(payload, timestamp, secret);

    expect(verifyDodoWebhookSignature({ payload, timestamp, signature, secret, now: Number(timestamp) * 1000 })).toBe(true);
    expect(verifyDodoWebhookSignature({ payload, timestamp, signature: "v1,bad", secret, now: Number(timestamp) * 1000 })).toBe(false);
  });
});

describe("BillingService", () => {
  it("syncs subscription lifecycle events into local billing state", async () => {
    const repository = new MemoryBillingRepository();
    const service = new BillingService(repository, new MemoryBillingGateway());

    await service.handleDodoSubscriptionEvent({
      eventId: "evt_1",
      type: "subscription.active",
      data: {
        subscription_id: "sub_1",
        product_id: "prod_builder",
        customer: { customer_id: "cus_1", email: "owner@example.com" },
        metadata: { user_id: "user_1" },
        next_billing_date: "2026-06-28T00:00:00.000Z"
      }
    }, { builderProductId: "prod_builder", studioProductId: "prod_studio" });

    expect(repository.accounts.get("user_1")).toMatchObject({
      userId: "user_1",
      planId: "builder",
      status: "active",
      dodoCustomerId: "cus_1",
      dodoSubscriptionId: "sub_1"
    });
  });

  it("processes concurrent duplicate subscription webhooks only once", async () => {
    const repository = new MemoryBillingRepository();
    const service = new BillingService(repository, new MemoryBillingGateway());
    const event = {
      eventId: "evt_duplicate",
      type: "subscription.active",
      data: {
        subscription_id: "sub_duplicate",
        product_id: "prod_builder",
        customer: { customer_id: "cus_duplicate", email: "owner@example.com" },
        metadata: { user_id: "user_1" },
        next_billing_date: "2026-06-28T00:00:00.000Z"
      }
    };

    const first = service.handleDodoSubscriptionEvent(event, {
      builderProductId: "prod_builder",
      studioProductId: "prod_studio"
    });
    const second = service.handleDodoSubscriptionEvent(event, {
      builderProductId: "prod_builder",
      studioProductId: "prod_studio"
    });

    await Promise.all([first, second]);

    expect(repository.upsertAccountCalls).toBe(1);
  });

  it("rejects subscription webhooks for unknown Dodo products instead of granting Builder", async () => {
    const repository = new MemoryBillingRepository();
    const service = new BillingService(repository, new MemoryBillingGateway());

    await expect(
      service.handleDodoSubscriptionEvent({
        eventId: "evt_unknown",
        type: "subscription.active",
        data: {
          subscription_id: "sub_unknown",
          product_id: "prod_other",
          customer: { customer_id: "cus_1", email: "owner@example.com" },
          metadata: { user_id: "user_1" }
        }
      }, { builderProductId: "prod_builder", studioProductId: "prod_studio" })
    ).rejects.toThrow("Unknown Dodo product");

    expect(repository.accounts.has("user_1")).toBe(false);
  });

  it("keeps paid access during cancel-at-period-end and reconciles by subscription id without metadata", async () => {
    const repository = new MemoryBillingRepository();
    repository.accounts.set("user_1", {
      userId: "user_1",
      planId: "builder",
      status: "active",
      dodoCustomerId: "cus_1",
      dodoSubscriptionId: "sub_1"
    });
    const service = new BillingService(repository, new MemoryBillingGateway());

    await service.handleDodoSubscriptionEvent({
      eventId: "evt_cancel",
      type: "subscription.cancelled",
      data: {
        subscription_id: "sub_1",
        product_id: "prod_builder",
        customer: { customer_id: "cus_1" },
        cancel_at_next_billing_date: true,
        next_billing_date: "2026-06-28T00:00:00.000Z"
      }
    }, { builderProductId: "prod_builder", studioProductId: "prod_studio" });

    expect(repository.accounts.get("user_1")).toMatchObject({
      planId: "builder",
      status: "active",
      cancelAtPeriodEnd: true
    });
  });

  it("emits paid usage events with stable idempotency keys", async () => {
    const repository = new MemoryBillingRepository();
    repository.accounts.set("user_1", {
      userId: "user_1",
      planId: "builder",
      status: "active",
      dodoCustomerId: "cus_1"
    });
    const gateway = new MemoryBillingGateway();
    const service = new BillingService(repository, gateway);

    await service.trackUsage({
      ownerUserId: "user_1",
      meter: "artifact.version_write",
      quantity: 1,
      idempotencyKey: "artifact_1:v2",
      metadata: { artifact_id: "artifact_1", version_number: "2" }
    });

    expect(gateway.events).toEqual([
      {
        customerId: "cus_1",
        eventName: "artifact.version_write",
        eventId: "artifact.version_write:artifact_1:v2",
        quantity: 1,
        metadata: { artifact_id: "artifact_1", version_number: "2", quantity: "1" }
      }
    ]);
  });

  it("records daily storage snapshots for active paid accounts only", async () => {
    const repository = new MemoryBillingRepository();
    repository.accounts.set("user_1", {
      userId: "user_1",
      planId: "builder",
      status: "active",
      dodoCustomerId: "cus_1"
    });
    repository.accounts.set("user_2", {
      userId: "user_2",
      planId: "builder",
      status: "cancelled",
      dodoCustomerId: "cus_2"
    });
    repository.usage.set("user_1", {
      activeArtifacts: 1,
      projects: 1,
      versionWritesThisMonth: 1,
      storageBytes: 1024 * 1024 * 1024,
      deliveryBytesThisMonth: 0
    });
    const gateway = new MemoryBillingGateway();
    const service = new BillingService(repository, gateway);

    await service.recordStorageSnapshotsForActiveAccounts(new Date("2026-05-28T12:00:00Z"));

    expect(gateway.events).toEqual([
      {
        customerId: "cus_1",
        eventName: "artifact.storage_gb_days",
        eventId: "artifact.storage_gb_days:user_1:2026-05-28",
        quantity: 1,
        metadata: {
          snapshot_date: "2026-05-28",
          storage_bytes: String(1024 * 1024 * 1024),
          quantity: "1"
        }
      }
    ]);
  });

  it("reconciles paid subscription accounts from Dodo snapshots", async () => {
    const repository = new MemoryBillingRepository();
    repository.accounts.set("user_1", {
      userId: "user_1",
      planId: "builder",
      status: "active",
      dodoCustomerId: "cus_1",
      dodoSubscriptionId: "sub_1",
      dodoProductId: "prod_builder",
      currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z")
    });
    const gateway = new MemoryBillingGateway();
    gateway.subscriptions.set("sub_1", {
      id: "sub_1",
      status: "expired",
      productId: "prod_builder",
      customerId: "cus_1",
      currentPeriodEnd: new Date("2026-06-05T00:00:00.000Z"),
      cancelAtPeriodEnd: false
    });
    const service = new BillingService(repository, gateway);

    await expect(service.reconcilePaidSubscriptions({
      builderProductId: "prod_builder",
      studioProductId: "prod_studio"
    })).resolves.toBe(1);

    expect(repository.accounts.get("user_1")).toMatchObject({
      status: "expired",
      currentPeriodEnd: new Date("2026-06-05T00:00:00.000Z")
    });
  });

  it("blocks free-only limits before paid features or overages are used", async () => {
    const repository = new MemoryBillingRepository();
    repository.usage.set("user_1", {
      activeArtifacts: 25,
      projects: 3,
      versionWritesThisMonth: 100,
      storageBytes: 100 * 1024 * 1024,
      deliveryBytesThisMonth: 0
    });
    const service = new BillingService(repository, new MemoryBillingGateway());

    await expect(service.assertCanCreateProject("user_1")).rejects.toBeInstanceOf(EntitlementLimitError);
    await expect(service.assertCanCreateArtifact("user_1", { publicView: false, publicEdit: false, contentBytes: 100 })).rejects.toMatchObject({
      message: "Private artifacts require Pro.",
      limit: "private_artifacts",
      requiredPlanId: "builder"
    });
    await expect(service.assertCanWriteVersion("user_1", { contentBytes: 1_048_577 })).rejects.toThrow("exceeds Builder");
  });

  it("enforces team workspace and seat entitlements", async () => {
    const repository = new MemoryBillingRepository();
    const service = new BillingService(repository, new MemoryBillingGateway());

    await expect(service.assertCanCreateTeamWorkspace("user_1")).rejects.toMatchObject({
      limit: "team_workspaces",
      requiredPlanId: "studio"
    });
    await expect(service.assertCanAddSeat("user_1", { seatsInUse: 1 })).rejects.toMatchObject({
      limit: "included_seats",
      requiredPlanId: "builder"
    });

    repository.accounts.set("user_team", {
      userId: "user_team",
      planId: "studio",
      status: "active",
      dodoCustomerId: "cus_team"
    });
    await expect(service.assertCanCreateTeamWorkspace("user_team")).resolves.toBeUndefined();
    await expect(service.assertCanAddSeat("user_team", { seatsInUse: 2 })).resolves.toBeUndefined();
    await expect(service.assertCanAddSeat("user_team", { seatsInUse: 3 })).rejects.toMatchObject({
      limit: "included_seats"
    });
  });
});

function sign(payload: string, timestamp: string, secret: string): string {
  return `v1,${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("base64")}`;
}

class MemoryBillingRepository implements BillingRepository {
  readonly accounts = new Map<string, {
    userId: string;
    planId: BillingPlanId;
    status: string;
    dodoCustomerId: string | null;
    dodoSubscriptionId?: string | null;
    dodoProductId?: string | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  }>();
  readonly processedEvents = new Set<string>();
  readonly usage = new Map<string, Awaited<ReturnType<BillingRepository["getUsage"]>>>();
  deferProcessedWebhookChecks = false;
  upsertAccountCalls = 0;
  private readonly releaseProcessedWebhookCheckFns: Array<() => void> = [];
  private processedWebhookWaiter: (() => void) | undefined;

  async getAccount(userId: string) {
    return this.accounts.get(userId);
  }

  async getAccountByDodoSubscriptionId(subscriptionId: string) {
    return [...this.accounts.values()].find((account) => account.dodoSubscriptionId === subscriptionId);
  }

  async getAccountByDodoCustomerId(customerId: string) {
    return [...this.accounts.values()].find((account) => account.dodoCustomerId === customerId);
  }

  async upsertAccount(account: {
    userId: string;
    planId: BillingPlanId;
    status: string;
    dodoCustomerId: string | null;
    dodoSubscriptionId?: string | null;
    dodoProductId?: string | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  }) {
    this.upsertAccountCalls += 1;
    this.accounts.set(account.userId, account);
  }

  async hasProcessedWebhook(eventId: string) {
    const alreadyProcessed = this.processedEvents.has(eventId);
    if (this.deferProcessedWebhookChecks) {
      await new Promise<void>((resolve) => {
        this.releaseProcessedWebhookCheckFns.push(resolve);
        this.processedWebhookWaiter?.();
      });
    }
    return alreadyProcessed;
  }

  async markWebhookProcessed(eventId: string) {
    this.processedEvents.add(eventId);
  }

  async upsertAccountForWebhook(eventId: string, _eventType: string, account: {
    userId: string;
    planId: BillingPlanId;
    status: string;
    dodoCustomerId: string | null;
    dodoSubscriptionId?: string | null;
    dodoProductId?: string | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  }) {
    if (this.processedEvents.has(eventId)) {
      return false;
    }

    this.processedEvents.add(eventId);
    await this.upsertAccount(account);
    return true;
  }

  releaseProcessedWebhookChecks(): void {
    this.deferProcessedWebhookChecks = false;
    for (const release of this.releaseProcessedWebhookCheckFns.splice(0)) {
      release();
    }
  }

  async waitForProcessedWebhookChecks(count: number): Promise<void> {
    while (this.releaseProcessedWebhookCheckFns.length < count) {
      await new Promise<void>((resolve) => {
        this.processedWebhookWaiter = resolve;
      });
      this.processedWebhookWaiter = undefined;
    }
  }

  async getUsage(userId: string) {
    return this.usage.get(userId) ?? {
      activeArtifacts: 0,
      projects: 0,
      versionWritesThisMonth: 0,
      storageBytes: 0,
      deliveryBytesThisMonth: 0
    };
  }

  async listBillableOwnerIds() {
    return [...this.accounts.values()]
      .filter((account) => account.planId !== "free" && (account.status === "active" || account.status === "trialing"))
      .map((account) => account.userId);
  }

  async listSubscriptionAccounts() {
    return [...this.accounts.values()].filter((account) => account.planId !== "free" && Boolean(account.dodoSubscriptionId));
  }
}

class MemoryBillingGateway implements BillingGateway {
  readonly events: Array<{ customerId: string; eventName: string; eventId: string; quantity: number; metadata: Record<string, string> }> = [];
  readonly checkoutInputs: Record<string, unknown>[] = [];
  readonly subscriptions = new Map<string, {
    id: string;
    status: string;
    productId?: string | null;
    customerId?: string | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  }>();

  async createCheckoutSession(input: Record<string, unknown>) {
    this.checkoutInputs.push(input);
    return { checkoutUrl: "https://checkout.example", sessionId: "checkout_1" };
  }

  async createPortalSession() {
    return { url: "https://portal.example" };
  }

  async ingestUsageEvent(event: { customerId: string; eventName: string; eventId: string; quantity: number; metadata: Record<string, string> }) {
    this.events.push(event);
  }

  async getSubscription(subscriptionId: string) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Missing subscription ${subscriptionId}`);
    }
    return subscription;
  }
}
