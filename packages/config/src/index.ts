import { z } from "zod";

const urlSchema = z.url();

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: urlSchema,
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  PUBLIC_APP_URL: urlSchema,
  S3_ENDPOINT: urlSchema,
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  DODO_PAYMENTS_API_KEY: z.string().min(1).optional(),
  DODO_PAYMENTS_WEBHOOK_SECRET: z.string().min(1).optional(),
  DODO_PAYMENTS_ENVIRONMENT: z.enum(["test_mode", "live_mode"]).default("test_mode"),
  DODO_BUILDER_PRODUCT_ID: z.string().min(1).optional(),
  DODO_STUDIO_PRODUCT_ID: z.string().min(1).optional(),
  ENABLE_BILLING_CRON: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  BILLING_CRON_INTERVAL_MS: z.coerce.number().int().positive().optional(),
  BILLING_CRON_SECRET: z.string().min(16).optional(),
  BETTER_STACK_SOURCE_TOKEN: z.string().min(1).optional(),
  BETTER_STACK_INGESTING_URL: urlSchema.optional(),
  BETTER_STACK_WEB_SOURCE_TOKEN: z.string().min(1).optional(),
  LOG_IP_SALT: z.string().min(1).optional(),
  AUTH_MD_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  AUTH_MD_SIGNING_SECRET: z.string().min(32).optional(),
  AUTH_MD_CLAIM_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  AUTH_MD_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  AUTH_MD_PRE_CLAIM_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  AUTH_MD_IDENTITY_ASSERTION_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  AUTH_MD_ALLOWED_SCOPES: z.string().min(1).default("artifacts:read"),
  AUTH_MD_ANONYMOUS_PRE_CLAIM_SCOPES: z.string().min(1).default("artifacts:read")
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(source);
}

export { loadMonorepoEnv } from "./load-monorepo-env.js";
