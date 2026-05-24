CREATE TYPE "public"."share_link_role" AS ENUM('viewer', 'editor');--> statement-breakpoint
ALTER TABLE "share_links" ALTER COLUMN "role" TYPE "share_link_role" USING (
  CASE WHEN "role"::text = 'editor' THEN 'editor'::"share_link_role" ELSE 'viewer'::"share_link_role" END
);
