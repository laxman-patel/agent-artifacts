import type { ServerEnv } from "@agent-artifacts/config";
import { loadServerEnv } from "@agent-artifacts/config";
import { getBillingService } from "../deps.js";
import { logger } from "../logger.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STARTUP_JITTER_MS = 60_000;

export function startBillingScheduler(env: ServerEnv = loadServerEnv()): (() => void) | undefined {
  if (!env.ENABLE_BILLING_CRON) {
    return undefined;
  }

  const intervalMs = env.BILLING_CRON_INTERVAL_MS ?? ONE_DAY_MS;
  let interval: ReturnType<typeof setInterval> | undefined;

  const run = async () => {
    try {
      await getBillingService().recordStorageSnapshotsForActiveAccounts();
      logger.info("billing_storage_snapshots_recorded");
    } catch (error) {
      logger.error("billing_storage_snapshots_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const startupDelay = Math.floor(Math.random() * STARTUP_JITTER_MS);
  const startup = setTimeout(() => {
    void run();
    interval = setInterval(() => void run(), intervalMs);
    interval.unref?.();
  }, startupDelay);
  startup.unref?.();

  logger.info("billing_scheduler_started", { intervalMs, startupDelay });

  return () => {
    clearTimeout(startup);
    if (interval) {
      clearInterval(interval);
    }
  };
}
