import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { projects, userProfiles } from "@agent-artifacts/db";

export async function getOwnerByUsername(db: Database, username: string) {
  const normalized = username.trim().toLowerCase();
  const [owner] = await db
    .select({ userId: userProfiles.userId, username: userProfiles.username })
    .from(userProfiles)
    .where(sql`lower(${userProfiles.username}) = ${normalized}`)
    .limit(1);

  return owner;
}

export async function getProjectIdByOwnerSlug(db: Database, username: string, projectSlug: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const [project] = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .innerJoin(userProfiles, eq(userProfiles.userId, projects.ownerUserId))
    .where(and(sql`lower(${userProfiles.username}) = ${normalizedUsername}`, sql`lower(${projects.slug}) = ${projectSlug}`))
    .limit(1);

  return project;
}
