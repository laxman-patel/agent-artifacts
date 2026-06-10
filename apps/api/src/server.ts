import "./load-env.js";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { startBillingScheduler } from "./billing/scheduler.js";
import { flushLogger, logger } from "./logger.js";

const port = Number(process.env.PORT ?? 3001);
const stopBillingScheduler = startBillingScheduler();

serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    logger.info("api listening", { url: `http://localhost:${info.port}` });
  }
);

const shutdown = async (signal: string) => {
  logger.info("api shutdown", { signal });
  stopBillingScheduler?.();
  await flushLogger();
  process.exit(0);
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
