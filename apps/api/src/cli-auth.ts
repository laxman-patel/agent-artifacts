import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { verifications, type Database } from "@agent-artifacts/db";

export interface CliAuthCodeEntry {
  userId: string;
  email: string;
}

const CLI_AUTH_CODE_TTL_MS = 2 * 60_000;
const CLI_AUTH_IDENTIFIER_PREFIX = "agent-artifacts-cli";

function identifierFor(code: string, state: string): string {
  return `${CLI_AUTH_IDENTIFIER_PREFIX}:${code}:${state}`;
}

export async function createCliAuthCode(db: Database, input: {
  state: string;
  userId: string;
  email: string;
}): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.insert(verifications).values({
    id: randomUUID(),
    identifier: identifierFor(code, input.state),
    value: JSON.stringify({
      userId: input.userId,
      email: input.email
    }),
    expiresAt: new Date(now.getTime() + CLI_AUTH_CODE_TTL_MS),
    createdAt: now,
    updatedAt: now
  });
  return code;
}

export async function consumeCliAuthCode(db: Database, code: string, state: string): Promise<CliAuthCodeEntry | undefined> {
  const [entry] = await db
    .delete(verifications)
    .where(and(eq(verifications.identifier, identifierFor(code, state)), gt(verifications.expiresAt, new Date())))
    .returning({ value: verifications.value });
  if (!entry) {
    return undefined;
  }

  const parsed = JSON.parse(entry.value) as Partial<CliAuthCodeEntry>;
  if (typeof parsed.userId !== "string") {
    return undefined;
  }
  return {
    userId: parsed.userId,
    email: typeof parsed.email === "string" ? parsed.email : ""
  };
}
