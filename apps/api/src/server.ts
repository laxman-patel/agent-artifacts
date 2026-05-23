import "./load-env.js";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { logger } from "./logger.js";

const port = Number(process.env.PORT ?? 3001);

serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    logger.info("api listening", { url: `http://localhost:${info.port}` });
  }
);
