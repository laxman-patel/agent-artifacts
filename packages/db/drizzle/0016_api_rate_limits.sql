CREATE TABLE "api_rate_limits" (
  "key" text PRIMARY KEY NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "reset_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
