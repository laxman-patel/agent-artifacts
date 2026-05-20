CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"slug" varchar(80) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "projects_owner_slug_unique" ON "projects" USING btree ("owner_user_id",lower("slug"));
--> statement-breakpoint
CREATE INDEX "projects_owner_idx" ON "projects" USING btree ("owner_user_id");
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_slug_format" CHECK ("projects"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("projects"."slug") BETWEEN 1 AND 80);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "project_id" text;
--> statement-breakpoint
INSERT INTO "projects" ("id", "owner_user_id", "slug", "title", "created_at", "updated_at")
SELECT
  'proj_default_' || a.owner_user_id,
  a.owner_user_id,
  'default',
  'Default',
  now(),
  now()
FROM (SELECT DISTINCT owner_user_id FROM "artifacts") AS a;
--> statement-breakpoint
UPDATE "artifacts" SET "project_id" = 'proj_default_' || "owner_user_id";
--> statement-breakpoint
ALTER TABLE "artifacts" ALTER COLUMN "project_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX "artifacts_owner_slug_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "artifacts_project_slug_unique" ON "artifacts" USING btree ("project_id",lower("slug"));
--> statement-breakpoint
CREATE INDEX "artifacts_project_idx" ON "artifacts" USING btree ("project_id");
