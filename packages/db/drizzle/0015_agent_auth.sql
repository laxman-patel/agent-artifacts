CREATE TYPE "agent_registration_type" AS ENUM ('service_auth', 'anonymous');
--> statement-breakpoint
CREATE TYPE "agent_registration_status" AS ENUM ('pending', 'claimed', 'revoked', 'expired');
--> statement-breakpoint
CREATE TYPE "agent_access_token_kind" AS ENUM ('pre_claim', 'post_claim');
--> statement-breakpoint
CREATE TABLE "agent_registrations" (
  "id" text PRIMARY KEY NOT NULL,
  "type" "agent_registration_type" NOT NULL,
  "status" "agent_registration_status" DEFAULT 'pending' NOT NULL,
  "owner_user_id" text,
  "login_hint" text,
  "provider_issuer" text,
  "provider_subject" text,
  "requested_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "claim_token_hash" varchar(64) NOT NULL,
  "claim_attempt_token_hash" varchar(64),
  "user_code_hash" varchar(64),
  "assertion_jti_hash" varchar(64),
  "claim_requested_at" timestamp with time zone,
  "claimed_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "claim_expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_issued_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agent_registrations_owner_user_id_user_id_fk"
    FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_registrations_claim_token_hash_unique" ON "agent_registrations" USING btree ("claim_token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_registrations_claim_attempt_token_hash_unique" ON "agent_registrations" USING btree ("claim_attempt_token_hash");
--> statement-breakpoint
CREATE INDEX "agent_registrations_user_code_idx" ON "agent_registrations" USING btree ("user_code_hash");
--> statement-breakpoint
CREATE INDEX "agent_registrations_owner_idx" ON "agent_registrations" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "agent_registrations_login_hint_idx" ON "agent_registrations" USING btree (lower("login_hint"));
--> statement-breakpoint
CREATE INDEX "agent_registrations_active_idx" ON "agent_registrations" USING btree ("status", "revoked_at", "expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_registrations_assertion_jti_hash_unique" ON "agent_registrations" USING btree ("assertion_jti_hash");
--> statement-breakpoint
CREATE TABLE "agent_access_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "registration_id" text NOT NULL,
  "owner_user_id" text,
  "token_hash" varchar(64) NOT NULL,
  "token_kind" "agent_access_token_kind" NOT NULL,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agent_access_tokens_registration_id_agent_registrations_id_fk"
    FOREIGN KEY ("registration_id") REFERENCES "public"."agent_registrations"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "agent_access_tokens_owner_user_id_user_id_fk"
    FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_access_tokens_token_hash_unique" ON "agent_access_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "agent_access_tokens_registration_idx" ON "agent_access_tokens" USING btree ("registration_id");
--> statement-breakpoint
CREATE INDEX "agent_access_tokens_active_token_idx" ON "agent_access_tokens" USING btree ("token_hash", "revoked_at", "expires_at");
--> statement-breakpoint
CREATE INDEX "agent_access_tokens_owner_idx" ON "agent_access_tokens" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE TABLE "agent_delegations" (
  "id" text PRIMARY KEY NOT NULL,
  "issuer" text NOT NULL,
  "subject" text NOT NULL,
  "audience" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "agent_delegations_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_delegations_issuer_subject_audience_unique" ON "agent_delegations" USING btree ("issuer", "subject", "audience");
--> statement-breakpoint
CREATE INDEX "agent_delegations_user_idx" ON "agent_delegations" USING btree ("user_id");
