import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export interface ArtifactStorage {
  putObject(input: PutObjectInput): Promise<void>;
  getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export function createVersionSourceKey(input: {
  ownerUserId: string;
  artifactId: string;
  versionNumber: number;
}): string {
  return `users/${input.ownerUserId}/artifacts/${input.artifactId}/versions/${input.versionNumber}/source`;
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
}
