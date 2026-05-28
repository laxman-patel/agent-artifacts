ALTER TABLE "audit_events" ADD COLUMN "workspace_id" text;--> statement-breakpoint
CREATE INDEX "audit_events_workspace_idx" ON "audit_events" USING btree ("workspace_id");
