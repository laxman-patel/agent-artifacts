import { timingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import { z } from "zod";
import {
  BILLING_PLANS,
  DODO_PRODUCT_CONFIG,
  DODO_USAGE_METERS,
  verifyDodoWebhookSignature,
  type BillingPlanId
} from "@agent-artifacts/billing";
import { loadServerEnv } from "@agent-artifacts/config";
import { getBillingService } from "../deps.js";
import { handle } from "../http/handler.js";
import { requireHumanPrincipal } from "../http/principal.js";
import { logger } from "../logger.js";
import type { AppVariables } from "../deps.js";

const paidPlanSchema = z.enum(["builder", "studio"]);

export function registerBillingRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/billing/plans", (c) =>
    handle(c, async () => {
      const env = loadServerEnv();
      return {
        plans: BILLING_PLANS,
        dodoProducts: DODO_PRODUCT_CONFIG,
        meters: DODO_USAGE_METERS,
        configuredProducts: {
          builder: Boolean(env.DODO_BUILDER_PRODUCT_ID),
          studio: Boolean(env.DODO_STUDIO_PRODUCT_ID)
        }
      };
    })
  );

  app.get("/api/billing/me", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);
      const billing = getBillingService();
      const [resolved, usage] = await Promise.all([
        billing.getAccountEntitlements(principal.id),
        billing.getUsage(principal.id)
      ]);

      return {
        plan: resolved.plan,
        account: resolved.account ?? null,
        usage
      };
    })
  );

  app.post("/api/billing/checkout", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);
      const body = z.object({ planId: paidPlanSchema }).parse(await c.req.json());
      const env = loadServerEnv();
      const productId = productIdForPlan(body.planId, env);
      if (!productId) {
        return c.json({ error: "billing_not_configured", message: `${body.planId} product ID is not configured.` }, 503);
      }
      if (!principal.email) {
        return c.json({ error: "billing_profile_incomplete", message: "Billing checkout requires a verified email." }, 400);
      }

      const session = await getBillingService().createCheckoutSession({
        planId: body.planId,
        productId,
        user: {
          id: principal.id,
          email: principal.email,
          name: principal.email
        },
        returnUrl: `${env.PUBLIC_APP_URL.replace(/\/+$/, "")}/settings/billing`
      });

      return session;
    })
  );

  app.post("/api/billing/portal", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);
      const env = loadServerEnv();
      return getBillingService().createPortalSession({
        userId: principal.id,
        returnUrl: `${env.PUBLIC_APP_URL.replace(/\/+$/, "")}/settings/billing`
      });
    })
  );

  app.post("/api/billing/storage-snapshot", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);
      await getBillingService().recordStorageSnapshot(principal.id);
      return { recorded: true };
    })
  );

  app.post("/api/internal/billing/storage-snapshots", (c) =>
    handle(c, async () => {
      const env = loadServerEnv();
      const expected = env.BILLING_CRON_SECRET;
      const provided = c.req.header("authorization")?.replace(/^bearer\s+/i, "");
      if (!expected || !provided) {
        return c.json({ error: "forbidden", message: "Valid billing cron credentials are required." }, 403);
      }

      const expectedBytes = Buffer.from(expected);
      const providedBytes = Buffer.from(provided);
      if (expectedBytes.byteLength !== providedBytes.byteLength || !timingSafeEqual(expectedBytes, providedBytes)) {
        return c.json({ error: "forbidden", message: "Valid billing cron credentials are required." }, 403);
      }

      await getBillingService().recordStorageSnapshotsForActiveAccounts();
      return { recorded: true };
    })
  );

  app.post("/api/webhooks/dodo", (c) =>
    handle(c, async () => {
      const env = loadServerEnv();
      if (!env.DODO_PAYMENTS_WEBHOOK_SECRET) {
        return c.json({ error: "billing_not_configured", message: "Dodo webhook secret is not configured." }, 503);
      }

      const payload = await c.req.text();
      const signature = c.req.header("webhook-signature") ?? "";
      const timestamp = c.req.header("webhook-timestamp") ?? "";
      const webhookId = c.req.header("webhook-id") ?? "";

      const verified = verifyDodoWebhookSignature({
        payload,
        signature,
        timestamp,
        secret: env.DODO_PAYMENTS_WEBHOOK_SECRET
      });
      if (!verified) {
        return c.json({ error: "invalid_signature", message: "Invalid Dodo webhook signature." }, 401);
      }

      let event: { id?: string; type: string; data: Record<string, unknown> };
      try {
        event = JSON.parse(payload) as { id?: string; type: string; data: Record<string, unknown> };
      } catch {
        return c.json({ error: "invalid_request", message: "Webhook body must be valid JSON." }, 400);
      }
      if (event.type.startsWith("subscription.")) {
        await getBillingService().handleDodoSubscriptionEvent(
          {
            eventId: webhookId || event.id || `${event.type}:${timestamp}`,
            type: event.type,
            data: event.data as never
          },
          {
            builderProductId: env.DODO_BUILDER_PRODUCT_ID,
            studioProductId: env.DODO_STUDIO_PRODUCT_ID
          }
        );
      } else {
        logger.warn("billing_webhook_unhandled", {
          eventId: webhookId || event.id,
          eventType: event.type
        });
      }

      return { received: true };
    })
  );
}

function productIdForPlan(planId: Exclude<BillingPlanId, "free">, env: ReturnType<typeof loadServerEnv>): string | undefined {
  return planId === "builder" ? env.DODO_BUILDER_PRODUCT_ID : env.DODO_STUDIO_PRODUCT_ID;
}
