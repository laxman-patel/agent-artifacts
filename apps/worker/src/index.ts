import { RenderWorker } from "./render-worker.js";

const worker = new RenderWorker();

worker.start().catch((err) => {
  console.error("[worker] failed to start:", err);
  process.exit(1);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    worker.stop().then(() => process.exit(0)).catch(() => process.exit(1));
  });
}
