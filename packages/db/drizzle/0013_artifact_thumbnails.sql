ALTER TABLE "artifacts" ADD COLUMN IF NOT EXISTS "thumbnail_object_key" text;
--> statement-breakpoint
ALTER TABLE "artifact_versions" ADD COLUMN IF NOT EXISTS "thumbnail_object_key" text;
