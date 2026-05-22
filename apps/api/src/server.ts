import "./load-env.js";
import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3001);

serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    console.log(`agent-artifacts API listening on http://localhost:${info.port}`);
  }
);
