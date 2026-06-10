import type { Hono } from "hono";
import { z } from "zod";
import { createCliAuthCode, consumeCliAuthCode } from "../cli-auth.js";
import { getApiKeyService } from "../deps.js";
import { handle } from "../http/handler.js";
import { requireHumanPrincipal } from "../http/principal.js";
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
  app.post("/api/cli/authorize", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);

      const body = cliAuthorizeInputSchema.parse(await c.req.json());
      const code = createCliAuthCode({
        state: body.state,
        userId: principal.id,
        email: principal.email ?? ""
      });

      const callbackUrl = new URL(`http://127.0.0.1:${body.port}/callback`);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", body.state);

      return { callbackUrl: callbackUrl.toString() };
    })
  );

  app.post("/api/cli/exchange", (c) =>
    handle(c, async () => {
      const body = cliExchangeInputSchema.parse(await c.req.json());
      const entry = consumeCliAuthCode(body.code, body.state);
      if (!entry) {
        return c.json({ error: "invalid_code", message: "CLI authorization code is invalid or expired." }, 400);
      }
      const apiKey = await getApiKeyService().createApiKey(entry.userId, {
        name: "CLI login",
        scopes: [
          "artifacts:read",
          "artifacts:create",
          "artifacts:update",
          "artifacts:delete",
          "artifacts:share",
          "artifacts:access:read",
          "artifacts:access:write",
          "agents:manage"
        ]
      });

      return {
        token: apiKey.token,
        apiKeyId: apiKey.id,
        email: entry.email || undefined
      };
    })
  );
}
