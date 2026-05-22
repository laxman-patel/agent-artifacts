import { loadMonorepoEnv } from "../config/src/load-monorepo-env.js";
import { defineConfig } from "drizzle-kit";

loadMonorepoEnv();

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ""
  }
});
