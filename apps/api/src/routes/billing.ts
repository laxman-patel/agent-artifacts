import type { Hono } from "hono";
import { getCheckoutService, getSeatAccountingService } from "../deps.js";
import { handle } from "../http/handler.js";
import { requirePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

export function registerBillingRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/workspaces/:workspaceId/billing", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const summary = await getSeatAccountingService().getWorkspaceSeatUsage(
        c.req.param("workspaceId"),
        principal
      );

      return {
        body: {
          account: summary.account,
          seats: summary.seats
        }
      };
    })
  );

  app.post("/api/workspaces/:workspaceId/billing/checkout", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const checkout = await getCheckoutService().createCheckoutSession(
        c.req.param("workspaceId"),
        principal
      );

      return { body: { checkout } };
    })
  );
}
