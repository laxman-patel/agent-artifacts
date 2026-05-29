import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { projects, userProfiles, users } from "@agent-artifacts/db";
import { usernameSchema } from "@agent-artifacts/shared";
import { ensurePersonalWorkspace } from "@agent-artifacts/workspace";
import { z } from "zod";

export interface ProfileUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
}

export interface ProfileDetails {
  username: string;
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ProfileNotFoundError extends Error {
  constructor() {
    super("User was not found.");
    this.name = "ProfileNotFoundError";
  }
}

export class UsernameAlreadySetError extends Error {
  constructor() {
    super("Username is already set for this account.");
    this.name = "UsernameAlreadySetError";
  }
}

export class UsernameTakenError extends Error {
  constructor() {
    super("That username is already taken.");
    this.name = "UsernameTakenError";
  }
}

export class ProfileService {
  constructor(private readonly db: Database) {}

  async getProfile(userId: string): Promise<{ user: ProfileUser; profile: ProfileDetails | null }> {
    const [userRow] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!userRow) {
      throw new ProfileNotFoundError();
    }

    const [profileRow] = await this.db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);

    return {
      user: {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        image: userRow.image,
        emailVerified: userRow.emailVerified
      },
      profile: profileRow
        ? {
            username: profileRow.username,
            displayName: profileRow.displayName,
            createdAt: profileRow.createdAt,
            updatedAt: profileRow.updatedAt
          }
        : null
    };
  }

  async claimUsername(userId: string, username: string): Promise<{ username: string }> {
    const body = z.object({ username: usernameSchema }).parse({ username });
    const normalizedUsername = body.username.trim().toLowerCase();

    const [existingProfile] = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (existingProfile) {
      throw new UsernameAlreadySetError();
    }

    const [userRow] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!userRow) {
      throw new ProfileNotFoundError();
    }

    const [usernameTaken] = await this.db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(sql`lower(${userProfiles.username}) = ${normalizedUsername}`)
      .limit(1);

    if (usernameTaken) {
      throw new UsernameTakenError();
    }

    const now = new Date();
    let workspaceId: string;
    await this.db.transaction(async (tx) => {
      await tx.insert(userProfiles).values({
        userId,
        username: normalizedUsername,
        displayName: userRow.name ?? null,
        createdAt: now,
        updatedAt: now
      });

      workspaceId = await ensurePersonalWorkspace(tx, {
        userId,
        username: normalizedUsername,
        displayName: userRow.name ?? null
      });

      await tx.insert(projects).values({
        id: randomUUID(),
        ownerUserId: userId,
        workspaceId,
        slug: "default",
        title: "Default",
        description: null,
        createdAt: now,
        updatedAt: now
      });
    });

    return { username: normalizedUsername };
  }
}
