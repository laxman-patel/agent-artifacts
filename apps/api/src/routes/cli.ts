import type { Hono } from "hono";
import { z } from "zod";
import { createCliAuthCode, consumeCliAuthCode, parseSessionTokenFromCookie } from "../cli-auth.js";
import { artifactErrorResponse } from "../http/errors.js";
import { requirePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

const cliAuthorizeInputSchema = z.object({
  port: z.number().int().min(1024).max(65_535),
  state: z.string().regex(/^[a-f0-9]{32}$/i)
});

const cliExchangeInputSchema = z.object({
  code: z.string().min(1),
  state: z.string().regex(/^[a-f0-9]{32}$/i)
});

export function registerCliRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.post("/api/cli/authorize", async (c) => {
    try {
      const principal = await requirePrincipal(c);
      if (principal.type !== "user") {
        return c.json({ error: "forbidden", message: "User session required." }, 403);
      }

      const body = cliAuthorizeInputSchema.parse(await c.req.json());
      const sessionToken = parseSessionTokenFromCookie(c.req.header("cookie"));
      if (!sessionToken) {
        return c.json({ error: "unauthorized", message: "Session cookie required." }, 401);
      }

      const code = createCliAuthCode({
        state: body.state,
        sessionToken,
        email: principal.email ?? ""
      });

      const callbackUrl = new URL(`http://127.0.0.1:${body.port}/callback`);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", body.state);

      return c.json({ callbackUrl: callbackUrl.toString() });
    } catch (error) {
      return artifactErrorResponse(c, error);
    }
  });

  app.post("/api/cli/exchange", async (c) => {
    try {
      const body = cliExchangeInputSchema.parse(await c.req.json());
      const entry = consumeCliAuthCode(body.code, body.state);
      if (!entry) {
        return c.json({ error: "invalid_code", message: "CLI authorization code is invalid or expired." }, 400);
      }

      return c.json({
        token: entry.sessionToken,
        email: entry.email || undefined
      });
    } catch (error) {
      return artifactErrorResponse(c, error);
    }
  });
}
