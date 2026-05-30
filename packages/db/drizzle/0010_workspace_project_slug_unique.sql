CREATE UNIQUE INDEX "projects_workspace_slug_unique" ON "projects" USING btree ("workspace_id",lower("slug")) WHERE "workspace_id" IS NOT NULL;
