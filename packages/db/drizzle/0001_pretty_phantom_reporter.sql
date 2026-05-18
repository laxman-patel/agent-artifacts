DROP TABLE "render_jobs" CASCADE;--> statement-breakpoint
DROP TABLE "render_outputs" CASCADE;--> statement-breakpoint
ALTER TABLE "artifact_versions" DROP COLUMN "validation_status";--> statement-breakpoint
ALTER TABLE "artifact_versions" DROP COLUMN "render_status";--> statement-breakpoint
ALTER TABLE "artifact_versions" DROP COLUMN "render_output_id";--> statement-breakpoint
DROP TYPE "public"."render_status";--> statement-breakpoint
DROP TYPE "public"."validation_status";