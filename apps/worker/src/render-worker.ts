import { randomUUID } from "node:crypto";
import { loadServerEnv } from "@agent-artifacts/config";
import { createDb, renderOutputs, artifactVersions, artifacts, type Database } from "@agent-artifacts/db";
import { renderMarkdown, buildReactPreviewHtml, wrapHtmlFragment } from "@agent-artifacts/renderer";
import { S3ArtifactStorage } from "@agent-artifacts/storage";
import { RENDER_QUEUE_NAME, type RenderJobData } from "@agent-artifacts/shared";
import { eq } from "drizzle-orm";
import { PgBoss, type Job, type WorkOptions } from "pg-boss";

export class RenderWorker {
  private readonly db: Database;
  private readonly storage: S3ArtifactStorage;
  private readonly boss: PgBoss;

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
    this.boss = new PgBoss(env.DATABASE_URL);
  }

  async start() {
    await this.boss.start();

    const workOptions: WorkOptions = { batchSize: 5 };

    await this.boss.work<RenderJobData>(
      RENDER_QUEUE_NAME,
      workOptions,
      async (jobs: Job<RenderJobData>[]) => {
        await Promise.all(jobs.map((job) => this.processJob(job.data.artifactVersionId)));
      }
    );

    console.log("[worker] render worker started, listening on queue:", RENDER_QUEUE_NAME);
  }

  async stop() {
    await this.boss.stop();
    console.log("[worker] render worker stopped");
  }

  private async processJob(artifactVersionId: string) {
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
      throw new Error(`artifact version ${artifactVersionId} not found`);
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
      .update(artifactVersions)
      .set({ renderStatus: "rendered", renderOutputId: outputId })
      .where(eq(artifactVersions.id, artifactVersionId));

    console.log(`[worker] rendered version ${artifactVersionId}`);
  }
}
