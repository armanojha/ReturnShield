/**
 * Phase 07A (task P7A-IMG-01) S3 access. The server always owns the object
 * key (`evidence/<uuid>`) — the client only ever receives a presigned URL,
 * never chooses or is trusted to supply a key. Presigned PUT expires in 5
 * minutes; presigned GET is short-lived and only ever returned from the
 * `GET /v1/images/{image_id}/download` route. Neither URL is ever logged
 * or persisted.
 */
import { randomUUID } from 'node:crypto';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOAD_EXPIRY_SECONDS = 5 * 60;
const DOWNLOAD_EXPIRY_SECONDS = 5 * 60;

export function newObjectKey(): string {
  return `evidence/${randomUUID()}`;
}

export class ImageEvidenceBucket {
  private readonly client: S3Client;
  constructor(private readonly bucketName: string) {
    this.client = new S3Client({});
  }

  async presignUpload(
    key: string,
    contentType: string,
  ): Promise<{ url: string; expiresAt: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: UPLOAD_EXPIRY_SECONDS });
    return {
      url,
      expiresAt: new Date(Date.now() + UPLOAD_EXPIRY_SECONDS * 1000).toISOString(),
    };
  }

  async presignDownload(key: string): Promise<{ url: string; expiresAt: string }> {
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
    const url = await getSignedUrl(this.client, command, { expiresIn: DOWNLOAD_EXPIRY_SECONDS });
    return {
      url,
      expiresAt: new Date(Date.now() + DOWNLOAD_EXPIRY_SECONDS * 1000).toISOString(),
    };
  }

  /**
   * Reads the private object's bytes directly (never via a presigned URL) —
   * used both for post-upload validation and to pass bytes to Bedrock
   * Converse. Returns `null` if the object does not exist (an unfinished or
   * abandoned upload).
   */
  async readObject(key: string): Promise<Uint8Array | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
      if (!result.Body) return null;
      const chunks: Uint8Array[] = [];
      for await (const chunk of result.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
      return Buffer.concat(chunks);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'NoSuchKey' ||
          error.name === 'NotFound' ||
          (error as Error & { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode === 404)
      )
        return null;
      throw error;
    }
  }
}
