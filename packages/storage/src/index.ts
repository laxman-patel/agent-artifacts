import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export interface StorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface PutObjectInput {
  key: string;
  body: string | Uint8Array;
  contentType: string;
}

export interface GetObjectOutput {
  body: Uint8Array;
  contentType?: string;
}

export interface ArtifactStorage {
  putObject(input: PutObjectInput): Promise<void>;
  getObject(key: string): Promise<GetObjectOutput>;
  getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteObject?(key: string): Promise<void>;
}

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function createVersionSourceKey(input: {
  ownerUserId: string;
  artifactId: string;
  versionNumber: number;
  attemptId?: string;
}): string {
  if (!ID_PATTERN.test(input.ownerUserId)) {
    throw new Error("createVersionSourceKey: ownerUserId must match [a-zA-Z0-9_-]{1,64}");
  }
  if (!ID_PATTERN.test(input.artifactId)) {
    throw new Error("createVersionSourceKey: artifactId must match [a-zA-Z0-9_-]{1,64}");
  }
  if (!Number.isInteger(input.versionNumber) || input.versionNumber <= 0) {
    throw new Error("createVersionSourceKey: versionNumber must be a positive integer");
  }
  const attemptId = input.attemptId ?? randomUUID();
  if (!ID_PATTERN.test(attemptId)) {
    throw new Error("createVersionSourceKey: attemptId must match [a-zA-Z0-9_-]{1,64}");
  }
  return `users/${input.ownerUserId}/artifacts/${input.artifactId}/versions/${input.versionNumber}/source-${attemptId}`;
}

export class S3ArtifactStorage implements ArtifactStorage {
  private readonly client: S3Client;

  constructor(private readonly config: StorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      forcePathStyle: true
    });
  }

  async putObject(input: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType
      })
    );
  }

  async getObject(key: string): Promise<GetObjectOutput> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      })
    );

    if (!response.Body) {
      return {
        body: new Uint8Array(),
        contentType: response.ContentType
      };
    }

    return {
      body: await response.Body.transformToByteArray(),
      contentType: response.ContentType
    };
  }

  async getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      }),
      { expiresIn: expiresInSeconds }
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      })
    );
  }
}
