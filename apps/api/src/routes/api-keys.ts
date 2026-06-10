import type { Hono } from "hono";
import { ApiKeyNotFoundError, createApiKeyInputSchema } from "@agent-artifacts/auth";
import { ArtifactForbiddenError, type Principal } from "@agent-artifacts/shared";
import { hasScope } from "@agent-artifacts/policy";
import { getApiKeyService } from "../deps.js";
import { handle } from "../http/handler.js";
import { requirePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

function apiKeyOwner(principal: Principal): string {
  if (principal.type === "user") {
    return principal.id;
  }
  if (principal.ownerUserId && hasScope(principal, "agents:manage")) {
    return principal.ownerUserId;
  }
  throw new ArtifactForbiddenError("API key management requires agents:manage scope.");
}

export function registerApiKeyRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/api-keys", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const apiKeys = await getApiKeyService().listApiKeys(apiKeyOwner(principal));

      return { apiKeys };
    })
  );

  app.post("/api/api-keys", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const body = createApiKeyInputSchema.parse(await c.req.json());
      const apiKey = await getApiKeyService().createApiKey(apiKeyOwner(principal), body);

      return { body: { apiKey }, status: 201 };
    })
  );

  app.delete("/api/api-keys/:apiKeyId", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const ownerUserId = apiKeyOwner(principal);
      try {
        await getApiKeyService().revokeApiKey(ownerUserId, c.req.param("apiKeyId"));
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
