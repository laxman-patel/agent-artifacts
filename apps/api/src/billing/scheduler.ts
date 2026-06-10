import type { ServerEnv } from "@agent-artifacts/config";
import { loadServerEnv } from "@agent-artifacts/config";
import { sql } from "drizzle-orm";
import { getAuditService, getBillingService, getDb } from "../deps.js";
import { logger } from "../logger.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STARTUP_JITTER_MS = 60_000;
const BILLING_SCHEDULER_LOCK_KEY = "agent-artifacts:billing-scheduler";

export function startBillingScheduler(env: ServerEnv = loadServerEnv()): (() => void) | undefined {
  if (!env.ENABLE_BILLING_CRON) {
    return undefined;
  }

  const intervalMs = env.BILLING_CRON_INTERVAL_MS ?? ONE_DAY_MS;
  let interval: ReturnType<typeof setInterval> | undefined;

  const run = async () => {
    try {
      await getDb().transaction(async (tx) => {
        const result = await tx.execute<{ locked: boolean }>(
          sql`SELECT pg_try_advisory_xact_lock(hashtext(${BILLING_SCHEDULER_LOCK_KEY})::bigint) AS locked`
        );
        const rows = "rows" in result ? result.rows : result;
        if (!rows[0]?.locked) {
          logger.info("billing_scheduler_lock_skipped");
          return;
        }

        const billingService = getBillingService();
        await billingService.recordStorageSnapshotsForActiveAccounts();
        logger.info("billing_storage_snapshots_recorded");
        const ownerIds = await billingService.listBillableOwnerIds();
        const deletedAuditEvents = await getAuditService().pruneExpiredAuditEventsForOwners(ownerIds);
        logger.info("billing_retention_pruned", { deletedAuditEvents });
      });
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
