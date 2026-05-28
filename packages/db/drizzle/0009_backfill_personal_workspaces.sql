-- Backfill personal workspaces for existing users and link their projects.
INSERT INTO "workspaces" ("id", "slug", "name", "kind", "state", "created_by_user_id", "personal_user_id", "created_at", "updated_at")
SELECT
  'ws_personal_' || up.user_id,
  up.username,
  COALESCE(up.display_name, up.username),
  'personal',
  'active',
  up.user_id,
  up.user_id,
  up.created_at,
  up.updated_at
FROM "user_profiles" AS up
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "workspace_members" ("id", "workspace_id", "user_id", "role", "created_at", "updated_at")
SELECT
  'wsm_' || up.user_id,
  'ws_personal_' || up.user_id,
  up.user_id,
  'owner',
  up.created_at,
  up.updated_at
FROM "user_profiles" AS up
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "projects" AS p
SET "workspace_id" = 'ws_personal_' || p.owner_user_id
WHERE p.workspace_id IS NULL;
