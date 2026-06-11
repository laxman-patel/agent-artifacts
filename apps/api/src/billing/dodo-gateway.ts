import DodoPayments from "dodopayments";
import type { BillingGateway, BillingSubscriptionSnapshot, BillingUsageMeterName } from "@agent-artifacts/billing";

export class DodoBillingGateway implements BillingGateway {
  constructor(private readonly client: DodoPayments) {}

  async createCheckoutSession(input: Record<string, unknown>): Promise<{ checkoutUrl: string; sessionId: string }> {
    const session = await this.client.checkoutSessions.create(input as unknown as DodoPayments.CheckoutSessionCreateParams);
    if (!session.checkout_url) {
      throw new Error("Dodo checkout session did not include a checkout URL.");
    }

    return {
      checkoutUrl: session.checkout_url,
      sessionId: session.session_id
    };
  }

  async createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    const portal = await this.client.customers.customerPortal.create(input.customerId, {
      return_url: input.returnUrl
    });

    return { url: portal.link };
  }

  async ingestUsageEvent(event: {
    customerId: string;
    eventName: BillingUsageMeterName;
    eventId: string;
    quantity: number;
    metadata: Record<string, string>;
  }): Promise<void> {
    await this.client.usageEvents.ingest({
      events: [
        {
          customer_id: event.customerId,
          event_id: event.eventId,
          event_name: event.eventName,
          timestamp: new Date().toISOString(),
          metadata: event.metadata
        }
      ]
    });
  }

  async getSubscription(subscriptionId: string): Promise<BillingSubscriptionSnapshot> {
    const subscriptions = (this.client as unknown as {
      subscriptions?: {
        retrieve?: (id: string) => Promise<Record<string, unknown>>;
        get?: (id: string) => Promise<Record<string, unknown>>;
      };
    }).subscriptions;
    const subscription = await (subscriptions?.retrieve
      ? subscriptions.retrieve(subscriptionId)
      : subscriptions?.get
        ? subscriptions.get(subscriptionId)
        : Promise.reject(new Error("Dodo subscriptions API is not available.")));

    return {
      id: String(subscription.subscription_id ?? subscription.id ?? subscriptionId),
      status: String(subscription.status ?? "active"),
      productId: stringValue(subscription.product_id ?? nestedValue(subscription.product, "product_id") ?? nestedValue(subscription.product, "id")),
      customerId: stringValue(subscription.customer_id ?? nestedValue(subscription.customer, "customer_id") ?? nestedValue(subscription.customer, "id")),
      currentPeriodEnd: dateValue(subscription.current_period_end ?? subscription.next_billing_date),
      cancelAtPeriodEnd: booleanValue(subscription.cancel_at_period_end ?? subscription.cancel_at_next_billing_date)
    };
  }
}

export class UnavailableBillingGateway implements BillingGateway {
  async createCheckoutSession(): Promise<{ checkoutUrl: string; sessionId: string }> {
    throw new Error("Dodo Payments is not configured.");
  }

  async createPortalSession(): Promise<{ url: string }> {
    throw new Error("Dodo Payments is not configured.");
  }

  async ingestUsageEvent(): Promise<void> {
    throw new Error("Dodo Payments is not configured.");
  }

  async getSubscription(): Promise<BillingSubscriptionSnapshot> {
    throw new Error("Dodo Payments is not configured.");
  }
}

function nestedValue(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function dateValue(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}
