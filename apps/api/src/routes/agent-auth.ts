import type { Hono } from "hono";
import {
  AGENT_AUTH_CLAIM_GRANT,
  JWT_BEARER_GRANT,
  agentClaimCompleteInputSchema,
  agentIdentityClaimInputSchema,
  agentIdentityInputSchema
} from "@agent-artifacts/auth";
import { z } from "zod";
import { getAgentAuthService } from "../deps.js";
import { handle } from "../http/handler.js";
import { requireHumanPrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

const tokenRequestSchema = z.object({
  grant_type: z.string().min(1),
  claim_token: z.string().min(1).optional(),
  assertion: z.string().min(1).optional()
});

const revokeRequestSchema = z.object({
  token: z.string().min(1)
});

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
  if (process.env.TRUST_PROXY !== "true") {
    return undefined;
  }
  return (
    c.req.header("cf-connecting-ip")?.trim() ??
    c.req.header("x-real-ip")?.trim() ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
  );
}

async function parseJsonOrForm(c: { req: { header: (name: string) => string | undefined; raw: Request } }) {
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = new URLSearchParams(await c.req.raw.clone().text());
    return Object.fromEntries(form.entries());
  }
  return c.req.raw.clone().json();
}

function oauthHeaders() {
  return {
    "cache-control": "no-store",
    pragma: "no-cache"
  };
}

export function registerAgentAuthRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.post("/agent/identity", (c) =>
    handle(c, async () => {
      const body = agentIdentityInputSchema.parse(await c.req.json());
      const identity = await getAgentAuthService().createIdentity(body, {
        ip: clientIp(c),
        userAgent: c.req.header("user-agent")
      });

      return { body: identity, status: 201, headers: oauthHeaders() };
    })
  );

  app.post("/agent/identity/claim", (c) =>
    handle(c, async () => {
      const body = agentIdentityClaimInputSchema.parse(await c.req.json());
      const claim = await getAgentAuthService().requestAnonymousClaim(body);

      return { body: claim, status: 201, headers: oauthHeaders() };
    })
  );

  app.post("/api/agent/identity/claim/complete", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);
      const body = agentClaimCompleteInputSchema.parse(await c.req.json());
      const claim = await getAgentAuthService().completeClaim(body, principal);

      return { body: claim, status: 200, headers: oauthHeaders() };
    })
  );

  app.post("/oauth2/token", (c) =>
    handle(c, async () => {
      const body = tokenRequestSchema.parse(await parseJsonOrForm(c));
      if (body.grant_type === AGENT_AUTH_CLAIM_GRANT) {
        if (!body.claim_token) {
          return c.json({ error: "invalid_request", error_description: "claim_token is required." }, 400, oauthHeaders());
        }
        return {
          body: await getAgentAuthService().exchangeClaimToken(body.claim_token),
          status: 200,
          headers: oauthHeaders()
        };
      }

      if (body.grant_type === JWT_BEARER_GRANT) {
        if (!body.assertion) {
          return c.json({ error: "invalid_request", error_description: "assertion is required." }, 400, oauthHeaders());
        }
        return {
          body: await getAgentAuthService().exchangeIdentityAssertion(body.assertion),
          status: 200,
          headers: oauthHeaders()
        };
      }

      return c.json({ error: "unsupported_grant_type" }, 400, oauthHeaders());
    })
  );

  app.post("/oauth2/revoke", (c) =>
    handle(c, async () => {
      const body = revokeRequestSchema.parse(await parseJsonOrForm(c));
      await getAgentAuthService().revokeAccessToken(body.token);
      return new Response(null, { status: 200, headers: oauthHeaders() });
    })
  );
}
