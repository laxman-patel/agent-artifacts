import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { shareLinks } from "@agent-artifacts/db";
import { readCookie, type ShareLinkRole, type PrincipalType } from "@agent-artifacts/shared";

export class ShareLinkNotFoundError extends Error {
  constructor(message = "Share link not found.") {
    super(message);
    this.name = "ShareLinkNotFoundError";
  }
}

export class ShareLinkExpiredError extends Error {
  constructor() {
    super("Share link has expired.");
    this.name = "ShareLinkExpiredError";
  }
}

export interface ShareLinkSummary {
  id: string;
  role: ShareLinkRole;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

export interface CreatedShareLink {
  id: string;
  shareUrl: string;
  role: ShareLinkRole;
  expiresAt: string | null;
}

export class ShareLinkService {
  constructor(
    private readonly db: Database,
    private readonly appUrl: string
  ) {}

  async createShareLink(input: {
    artifactId: string;
    role: ShareLinkRole;
    expiresAt?: Date;
    createdByPrincipalType: PrincipalType;
    createdByPrincipalId: string;
  }): Promise<CreatedShareLink> {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashShareToken(token);
    const linkId = randomUUID();

    await this.db.insert(shareLinks).values({
      id: linkId,
      artifactId: input.artifactId,
      tokenHash,
      role: input.role,
      createdByPrincipalType: input.createdByPrincipalType,
      createdByPrincipalId: input.createdByPrincipalId,
      createdAt: new Date(),
      expiresAt: input.expiresAt ?? null
    });

    return {
      id: linkId,
      shareUrl: `${this.appUrl.replace(/\/+$/, "")}/share/${token}`,
      role: input.role,
      expiresAt: input.expiresAt?.toISOString() ?? null
    };
  }

  async listShareLinks(artifactId: string): Promise<ShareLinkSummary[]> {
    const rows = await this.db
      .select({
        id: shareLinks.id,
        role: shareLinks.role,
        createdAt: shareLinks.createdAt,
        expiresAt: shareLinks.expiresAt,
        revokedAt: shareLinks.revokedAt,
        lastUsedAt: shareLinks.lastUsedAt
      })
      .from(shareLinks)
      .where(eq(shareLinks.artifactId, artifactId));

    return rows.map((row) => ({
      ...row,
      role: row.role === "editor" ? "editor" : "viewer"
    }));
  }

  async getShareLinkById(shareLinkId: string) {
    const [link] = await this.db.select().from(shareLinks).where(eq(shareLinks.id, shareLinkId)).limit(1);
    return link;
  }

  async revokeShareLink(shareLinkId: string): Promise<void> {
    await this.db.update(shareLinks).set({ revokedAt: new Date() }).where(eq(shareLinks.id, shareLinkId));
  }

  async resolveActiveShareLink(token: string) {
    const tokenHash = hashShareToken(token);

    const [link] = await this.db
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.tokenHash, tokenHash), isNull(shareLinks.revokedAt)))
      .limit(1);

    if (!link) {
      throw new ShareLinkNotFoundError("Share link not found or revoked.");
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new ShareLinkExpiredError();
    }

    await this.db.update(shareLinks).set({ lastUsedAt: new Date() }).where(eq(shareLinks.id, link.id));

    return link;
  }

  async resolveCookieGrant(
    cookieHeader: string | null | undefined,
    artifactId: string
  ): Promise<{ shareLinkId: string; role: ShareLinkRole } | null> {
    const token = readCookie(cookieHeader, `aa_share_${artifactId}`);
    if (!token) {
      return null;
    }

    const tokenHash = hashShareToken(token);

    const [link] = await this.db
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.tokenHash, tokenHash), isNull(shareLinks.revokedAt)))
      .limit(1);

    if (!link || link.artifactId !== artifactId) {
      return null;
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      return null;
    }

    return {
      shareLinkId: link.id,
      role: link.role
    };
  }
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
