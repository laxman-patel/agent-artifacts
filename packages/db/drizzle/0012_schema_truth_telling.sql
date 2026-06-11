-- Drop artifact archive state: archive/fork were de-scoped; only active and soft-deleted artifacts remain supported.
UPDATE "artifacts" SET "state" = 'deleted' WHERE "state" = 'archived';
ALTER TYPE "artifact_state" RENAME TO "artifact_state_old";
CREATE TYPE "artifact_state" AS ENUM ('active', 'deleted');
ALTER TABLE "artifacts" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "artifacts"
  ALTER COLUMN "state" TYPE "artifact_state"
  USING "state"::text::"artifact_state";
ALTER TABLE "artifacts" ALTER COLUMN "state" SET DEFAULT 'active';
DROP TYPE "artifact_state_old";
--> statement-breakpoint
-- Drop unsupported permission subjects: agent/api_key/share_link grants are modeled elsewhere and never resolved from artifact_permissions.
DELETE FROM "artifact_permissions" WHERE "subject_type" IN ('agent', 'api_key', 'share_link');
ALTER TYPE "permission_subject_type" RENAME TO "permission_subject_type_old";
CREATE TYPE "permission_subject_type" AS ENUM ('anyone', 'user', 'email');
ALTER TABLE "artifact_permissions"
  ALTER COLUMN "subject_type" TYPE "permission_subject_type"
  USING "subject_type"::text::"permission_subject_type";
DROP TYPE "permission_subject_type_old";
