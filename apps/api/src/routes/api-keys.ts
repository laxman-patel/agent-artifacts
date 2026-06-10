import type { Hono } from "hono";
import { ApiKeyNotFoundError, createApiKeyInputSchema } from "@agent-artifacts/auth";
import { getApiKeyService } from "../deps.js";
import { handle } from "../http/handler.js";
import { requireHumanPrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

export function registerApiKeyRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/api-keys", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);
      const apiKeys = await getApiKeyService().listApiKeys(principal.id);

      return { apiKeys };
    })
  );

  app.post("/api/api-keys", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);
      const body = createApiKeyInputSchema.parse(await c.req.json());
      const apiKey = await getApiKeyService().createApiKey(principal.id, body);

      return { body: { apiKey }, status: 201 };
    })
  );

  app.delete("/api/api-keys/:apiKeyId", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);
      try {
        await getApiKeyService().revokeApiKey(principal.id, c.req.param("apiKeyId"));
      } catch (error) {
        if (error instanceof ApiKeyNotFoundError) {
          return c.json({ error: "not_found", message: error.message }, 404);
        }
        throw error;
      }

      return { revoked: true };
    })
  );
}
