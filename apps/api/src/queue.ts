import { PgBoss } from "pg-boss";
import { RENDER_QUEUE_NAME, type RenderJobData } from "@agent-artifacts/shared";

let bossInstance: PgBoss | undefined;
let startPromise: Promise<void> | undefined;

export function getQueue(connectionString: string): PgBoss {
  if (!bossInstance) {
    bossInstance = new PgBoss({ connectionString });
  }
  return bossInstance;
}

export async function ensureQueueStarted(connectionString: string): Promise<void> {
  const boss = getQueue(connectionString);
  startPromise ??= boss.start().then(() => undefined);
  return startPromise;
}

export async function enqueueRenderJob(connectionString: string, artifactVersionId: string): Promise<void> {
  await ensureQueueStarted(connectionString);
  const boss = getQueue(connectionString);
  await boss.send(RENDER_QUEUE_NAME, { artifactVersionId } satisfies RenderJobData, {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true
  });
}
