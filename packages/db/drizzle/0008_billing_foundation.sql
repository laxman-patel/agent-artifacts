CREATE TYPE "billing_plan" AS ENUM('free', 'builder', 'studio');
--> statement-breakpoint
CREATE TYPE "billing_subscription_status" AS ENUM('active', 'trialing', 'on_hold', 'cancelled', 'expired', 'failed');
--> statement-breakpoint
CREATE TYPE "billing_usage_meter" AS ENUM('artifact.storage_gb_days', 'artifact.delivery_gb', 'artifact.version_write');
--> statement-breakpoint
CREATE TABLE "billing_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"plan_id" "billing_plan" DEFAULT 'free' NOT NULL,
	"status" "billing_subscription_status" DEFAULT 'active' NOT NULL,
	"dodo_customer_id" text,
	"dodo_subscription_id" text,
	"dodo_product_id" text,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"meter" "billing_usage_meter" NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"dodo_event_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_usage_events" ADD CONSTRAINT "billing_usage_events_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "billing_accounts_dodo_customer_idx" ON "billing_accounts" USING btree ("dodo_customer_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_accounts_dodo_subscription_unique" ON "billing_accounts" USING btree ("dodo_subscription_id");
--> statement-breakpoint
CREATE INDEX "billing_usage_events_owner_meter_idx" ON "billing_usage_events" USING btree ("owner_user_id","meter");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_usage_events_dodo_event_unique" ON "billing_usage_events" USING btree ("dodo_event_id");
