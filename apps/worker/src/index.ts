import { RenderWorker } from "./render-worker.js";

const worker = new RenderWorker();

worker.start();

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    worker.stop();
    process.exit(0);
  });
}
