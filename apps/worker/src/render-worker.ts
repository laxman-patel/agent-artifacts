import { randomUUID } from "node:crypto";
import { loadServerEnv } from "@agent-artifacts/config";
import { createDb, renderJobs, renderOutputs, artifactVersions, artifacts, type Database } from "@agent-artifacts/db";
import { renderMarkdown, buildReactPreviewHtml, wrapHtmlFragment } from "@agent-artifacts/renderer";
import { S3ArtifactStorage } from "@agent-artifacts/storage";
import { eq, and, lt } from "drizzle-orm";

const POLL_INTERVAL_MS = 5_000;
const MAX_ATTEMPTS = 3;

export class RenderWorker {
  private readonly db: Database;
  private readonly storage: S3ArtifactStorage;
  private running = false;
  private timer: NodeJS.Timeout | undefined;

  constructor() {
    const env = loadServerEnv();
    this.db = createDb({ connectionString: env.DATABASE_URL });
    this.storage = new S3ArtifactStorage({
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log("[worker] render worker started");
    this.scheduleNextPoll();
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    console.log("[worker] render worker stopped");
  }

  private scheduleNextPoll() {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.poll().finally(() => this.scheduleNextPoll());
    }, POLL_INTERVAL_MS);
  }

  private async poll() {
    const jobs = await this.db
      .select()
      .from(renderJobs)
      .where(
        and(
          eq(renderJobs.status, "pending"),
          lt(renderJobs.attempts, MAX_ATTEMPTS)
        )
      )
      .limit(10);

    for (const job of jobs) {
      await this.processJob(job.id, job.artifactVersionId);
    }
  }

  private async processJob(jobId: string, artifactVersionId: string) {
    await this.db
      .update(renderJobs)
      .set({ attempts: 1, updatedAt: new Date() })
      .where(eq(renderJobs.id, jobId));

    try {
      const [row] = await this.db
        .select({
          version: artifactVersions,
          artifactType: artifacts.type
        })
        .from(artifactVersions)
        .innerJoin(artifacts, eq(artifacts.id, artifactVersions.artifactId))
        .where(eq(artifactVersions.id, artifactVersionId))
        .limit(1);

      if (!row) {
        await this.markJobFailed(jobId, "artifact version not found");
        return;
      }

      const { version, artifactType } = row;

      const { body } = await this.storage.getObject(version.contentObjectKey);
      const source = new TextDecoder().decode(body);

      let renderedHtml: string;
      if (artifactType === "markdown") {
        renderedHtml = await renderMarkdown(source);
      } else if (artifactType === "react") {
        renderedHtml = buildReactPreviewHtml(source);
      } else {
        renderedHtml = wrapHtmlFragment(source);
      }

      const outputKey = `${version.contentObjectKey.replace("/source", "")}/rendered`;
      await this.storage.putObject({
        key: outputKey,
        body: Buffer.from(renderedHtml, "utf-8"),
        contentType: "text/html; charset=utf-8"
      });

      const outputId = randomUUID();
      await this.db.insert(renderOutputs).values({
        id: outputId,
        artifactVersionId,
        outputObjectKey: outputKey,
        status: "rendered",
        diagnostics: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await this.db
        .update(renderJobs)
        .set({ status: "rendered", updatedAt: new Date() })
        .where(eq(renderJobs.id, jobId));

      await this.db
        .update(artifactVersions)
        .set({ renderStatus: "rendered", renderOutputId: outputId })
        .where(eq(artifactVersions.id, artifactVersionId));

      console.log(`[worker] rendered version ${artifactVersionId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[worker] failed to render version ${artifactVersionId}: ${message}`);
      await this.markJobFailed(jobId, message);
    }
  }

  private async markJobFailed(jobId: string, error: string) {
    await this.db
      .update(renderJobs)
      .set({ status: "failed", lastError: error, updatedAt: new Date() })
      .where(eq(renderJobs.id, jobId));
  }
}
