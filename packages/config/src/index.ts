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
  BETTER_STACK_SOURCE_TOKEN: z.string().min(1).optional(),
  BETTER_STACK_INGESTING_URL: urlSchema.optional(),
  BETTER_STACK_WEB_SOURCE_TOKEN: z.string().min(1).optional(),
  LOG_IP_SALT: z.string().min(1).optional(),
  DODO_PAYMENTS_API_KEY: z.string().min(1).optional(),
  DODO_STUDIO_PRODUCT_ID: z.string().min(1).optional(),
  DODO_EXTRA_SEAT_PRODUCT_ID: z.string().min(1).optional()
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(source);
}

export { loadMonorepoEnv } from "./load-monorepo-env.js";
