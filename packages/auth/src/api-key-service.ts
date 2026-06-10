import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { apiKeys, type Database } from "@agent-artifacts/db";
import { agentScopeSchema, type AgentScope, type Principal } from "@agent-artifacts/shared";
import { z } from "zod";

export const API_KEY_PREFIX = "aa_k_";

export const createApiKeyInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(agentScopeSchema).min(1)
});

export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;

export interface ApiKeySummary {
  id: string;
  userId: string;
  name: string;
  scopes: AgentScope[];
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface CreatedApiKey extends ApiKeySummary {
  token: string;
}

export class ApiKeyNotFoundError extends Error {
  constructor() {
    super("API key was not found.");
    this.name = "ApiKeyNotFoundError";
  }
}

function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createApiKeyToken(): string {
  return `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

function toSummary(row: typeof apiKeys.$inferSelect): ApiKeySummary {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    scopes: agentScopeSchema.array().parse(row.scopes),
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt
  };
}

export class ApiKeyService {
  constructor(private readonly db: Database) {}

  async createApiKey(userId: string, input: CreateApiKeyInput): Promise<CreatedApiKey> {
    const parsed = createApiKeyInputSchema.parse(input);
    const id = randomUUID();
    const token = createApiKeyToken();
    const now = new Date();

    const [created] = await this.db
      .insert(apiKeys)
      .values({
        id,
        userId,
        name: parsed.name,
        tokenHash: hashApiKey(token),
        scopes: parsed.scopes,
        createdAt: now
      })
      .returning();
    if (!created) {
      throw new Error("API key could not be created.");
    }

    return { ...toSummary(created), token };
  }

  async listApiKeys(userId: string): Promise<ApiKeySummary[]> {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));

    return rows.map(toSummary);
  }

  async revokeApiKey(userId: string, apiKeyId: string): Promise<void> {
    const [revoked] = await this.db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });

    if (!revoked) {
      throw new ApiKeyNotFoundError();
    }
  }

  async authenticateToken(token: string): Promise<Principal | undefined> {
    if (!token.startsWith(API_KEY_PREFIX)) {
      return undefined;
    }

    const [key] = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.tokenHash, hashApiKey(token)), isNull(apiKeys.revokedAt)))
      .limit(1);
    if (!key) {
      return undefined;
    }

    await this.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));

    return {
      type: "api_key",
      id: key.id,
      ownerUserId: key.userId,
      scopes: agentScopeSchema.array().parse(key.scopes)
    };
  }
}
