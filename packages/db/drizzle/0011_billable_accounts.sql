CREATE TYPE "public"."billable_subject_type" AS ENUM('personal', 'workspace');--> statement-breakpoint
CREATE TABLE "billable_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_type" "billable_subject_type" NOT NULL,
	"subject_id" text NOT NULL,
	"dodo_customer_id" text,
	"dodo_subscription_id" text,
	"plan_id" text,
	"included_seats" integer DEFAULT 0 NOT NULL,
	"extra_seats" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "billable_accounts_subject_unique" ON "billable_accounts" USING btree ("subject_type","subject_id");
