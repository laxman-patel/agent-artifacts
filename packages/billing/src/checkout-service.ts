import { eq } from "drizzle-orm";
import type { ServerEnv } from "@agent-artifacts/config";
import type { Database } from "@agent-artifacts/db";
import { users } from "@agent-artifacts/db";
import type { Principal } from "@agent-artifacts/shared";
import { WorkspaceForbiddenError, WorkspaceNotFoundError } from "@agent-artifacts/shared";
import type { WorkspaceAccess } from "@agent-artifacts/workspace";
import type { WorkspaceRepository } from "@agent-artifacts/workspace";
import DodoPayments from "dodopayments";
import type { BillableSubjectService } from "./billable-subject-service.js";

export interface CheckoutSessionResult {
  checkoutUrl: string;
  sessionId: string | null;
  stub: boolean;
}

export interface CheckoutServiceConfig {
  publicAppUrl: string;
  dodoPaymentsApiKey?: string;
  dodoStudioProductId?: string;
  dodoExtraSeatProductId?: string;
}

export class CheckoutService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly billableSubjectService: BillableSubjectService,
    private readonly access: WorkspaceAccess,
    private readonly db: Database,
    private readonly config: CheckoutServiceConfig
  ) {}

  async createCheckoutSession(workspaceId: string, principal: Principal): Promise<CheckoutSessionResult> {
    if (principal.type !== "user") {
      throw new WorkspaceForbiddenError("Only signed-in users can start workspace checkout.");
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

    await this.billableSubjectService.resolveForWorkspace(workspaceId);

    if (this.canUseDodoCheckout()) {
      return this.createDodoCheckoutSession(workspaceId, principal);
    }

    return this.createStubCheckoutSession(workspaceId);
  }

  private canUseDodoCheckout(): boolean {
    return Boolean(this.config.dodoPaymentsApiKey && this.config.dodoStudioProductId);
  }

  private createStubCheckoutSession(workspaceId: string): CheckoutSessionResult {
    const checkoutUrl = new URL("/checkout/stub", this.config.publicAppUrl);
    checkoutUrl.searchParams.set("workspaceId", workspaceId);

    return {
      checkoutUrl: checkoutUrl.toString(),
      sessionId: null,
      stub: true
    };
  }

  private async createDodoCheckoutSession(
    workspaceId: string,
    principal: Principal
  ): Promise<CheckoutSessionResult> {
    const [user] = await this.db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, principal.id))
      .limit(1);

    if (!user?.email) {
      throw new WorkspaceForbiddenError("A verified email is required to start checkout.");
    }

    const client = new DodoPayments({
      bearerToken: this.config.dodoPaymentsApiKey!,
      environment: this.config.publicAppUrl.includes("localhost") ? "test_mode" : "live_mode"
    });

    const productCart = [{ product_id: this.config.dodoStudioProductId!, quantity: 1 }];

    const session = await client.checkoutSessions.create({
      product_cart: productCart,
      customer: {
        email: user.email,
        name: user.name
      },
      metadata: {
        workspace_id: workspaceId,
        billable_subject_type: "workspace"
      },
      return_url: `${this.config.publicAppUrl}/checkout/success?workspaceId=${encodeURIComponent(workspaceId)}`
    });

    return {
      checkoutUrl: session.checkout_url ?? `${this.config.publicAppUrl}/checkout/success`,
      sessionId: session.session_id ?? null,
      stub: false
    };
  }
}

export function createCheckoutServiceConfig(env: ServerEnv): CheckoutServiceConfig {
  return {
    publicAppUrl: env.PUBLIC_APP_URL,
    dodoPaymentsApiKey: env.DODO_PAYMENTS_API_KEY,
    dodoStudioProductId: env.DODO_STUDIO_PRODUCT_ID,
    dodoExtraSeatProductId: env.DODO_EXTRA_SEAT_PRODUCT_ID
  };
}

export function createCheckoutService(
  db: Database,
  billableSubjectService: BillableSubjectService,
  workspaceRepository: WorkspaceRepository,
  access: WorkspaceAccess,
  config: CheckoutServiceConfig
): CheckoutService {
  return new CheckoutService(workspaceRepository, billableSubjectService, access, db, config);
}
