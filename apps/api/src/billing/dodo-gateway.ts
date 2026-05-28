import DodoPayments from "dodopayments";
import type { BillingGateway, BillingUsageMeterName } from "@agent-artifacts/billing";

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
}
