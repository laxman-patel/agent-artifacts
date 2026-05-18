import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { shareLinks, type Database } from "@agent-artifacts/db";

export interface ShareSessionGrant {
  shareLinkId: string;
  role: "viewer" | "editor";
}

/**
 * Reads the artifact-scoped share cookie (`aa_share_{artifactId}=<token>`)
 * from the request and resolves it to a share-link grant.
 *
 * Returns null if no cookie, invalid token, revoked link, or expired link.
 *
 * The augmented principal returned by callers should be passed into the
 * policy engine so editor share-links actually grant edit role (not just
 * viewer) for the artifact the cookie was issued against.
 */
export async function resolveShareGrant(
  db: Database,
  request: Request,
  artifactId: string
): Promise<ShareSessionGrant | null> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const token = readCookie(cookieHeader, `aa_share_${artifactId}`);
  if (!token) return null;

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.tokenHash, tokenHash), isNull(shareLinks.revokedAt)))
    .limit(1);

  if (!link) return null;
  if (link.artifactId !== artifactId) return null;
  if (link.expiresAt && link.expiresAt < new Date()) return null;

  return {
    shareLinkId: link.id,
    role: link.role === "editor" ? "editor" : "viewer"
  };
}

function readCookie(header: string, name: string): string | undefined {
  for (const segment of header.split(";")) {
    const trimmed = segment.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq) === name) {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }
  return undefined;
}
