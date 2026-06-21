#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const requiredEnv = [
  "INFISICAL_PROJECT_ID",
  "RAILWAY_PROJECT_ID",
  "RAILWAY_ENVIRONMENT_ID",
  "RAILWAY_API_SERVICE_ID",
  "RAILWAY_WEB_SERVICE_ID",
];

const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }

  return result.stdout;
}

function exportSecrets(path) {
  const output = run(
    "infisical",
    [
      "export",
      "--projectId",
      process.env.INFISICAL_PROJECT_ID,
      "--env",
      "prod",
      "--path",
      path,
      "--format",
      "json",
      "--silent",
    ],
    { capture: true },
  );

  const secrets = JSON.parse(output);

  return Object.fromEntries(
    secrets.map((secret) => [secret.key, secret.value]),
  );
}

function syncService(serviceName, serviceId, variables) {
  const keys = Object.keys(variables).sort();
  console.log(`${dryRun ? "Would sync" : "Syncing"} ${keys.length} variables to ${serviceName}: ${keys.join(", ")}`);

  if (dryRun) {
    return;
  }

  for (const key of keys) {
    run("railway", [
      "variables",
      "set",
      `${key}=${variables[key]}`,
      "--project",
      process.env.RAILWAY_PROJECT_ID,
      "--environment",
      process.env.RAILWAY_ENVIRONMENT_ID,
      "--service",
      serviceId,
    ]);
  }
}

const shared = exportSecrets("/shared");
const api = exportSecrets("/api");
const web = exportSecrets("/web");

syncService("api", process.env.RAILWAY_API_SERVICE_ID, {
  ...shared,
  ...api,
});

syncService("web", process.env.RAILWAY_WEB_SERVICE_ID, {
  ...shared,
  ...web,
});
