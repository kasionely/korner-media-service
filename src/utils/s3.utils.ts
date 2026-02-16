import { PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Readable } from "stream";

import { cacheValues } from "./cache";
import redis from "./redis";
import s3Client from "./s3";
import yandexS3 from "./ys3";

export async function uploadToBothBuckets(
  username: string,
  buffer: Buffer,
  outputFilename: string,
  contentType: string
): Promise<string> {
  const s3Key = `${username}/${outputFilename}`;
  const commonParams = {
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  };

  const primaryBucket = process.env.ACTIVE_ENV === "prod" ? "korner-pro" : "korner-lol";
  const yandexBucket = process.env.ACTIVE_ENV === "prod" ? "korner-pro" : "korner-lol";

  await Promise.all([
    s3Client.send(new PutObjectCommand({ ...commonParams, Bucket: primaryBucket })),
    yandexS3.send(new PutObjectCommand({ ...commonParams, Bucket: yandexBucket })),
  ]);

  const baseUrl =
    process.env.ACTIVE_ENV === "prod" ? "https://cdn.korner.pro" : "https://cdn.korner.lol";

  return `${baseUrl}/${s3Key}`;
}

export async function deleteFromBothBuckets(username: string, key: string): Promise<void> {
  const primaryBucket = process.env.ACTIVE_ENV === "prod" ? "korner-pro" : "korner-lol";
  const yandexBucket = process.env.ACTIVE_ENV === "prod" ? "korner-pro" : "korner-lol";

  await Promise.all([
    s3Client.send(new DeleteObjectCommand({ Bucket: primaryBucket, Key: key })),
    yandexS3.send(new DeleteObjectCommand({ Bucket: yandexBucket, Key: key })),
  ]);

  // Clear cache
  const cacheKey = `file:${key}`;
  const metadataKey = `metadata:${key}`;
  await redis.del([cacheKey, metadataKey]);
}

export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function cacheFileToRedis(
  key: string,
  buffer: Buffer,
  contentType?: string,
  contentLength?: number,
  lastModified?: Date
): Promise<void> {
  const cacheKey = `file:${key}`;
  const metadataKey = `metadata:${key}`;

  await Promise.all([
    redis.setex(cacheKey, cacheValues.day, buffer),
    redis.hset(metadataKey, {
      ContentType: contentType || "",
      ContentLength: contentLength?.toString() || buffer.length.toString(),
      LastModified: lastModified?.toUTCString() || "",
    }),
    redis.expire(metadataKey, cacheValues.day),
  ]);
}

export async function getUserStorageUsage(username: string): Promise<{
  totalSize: number;
  fileCount: number;
  files: Array<{ key: string; size: number; lastModified?: Date }>;
}> {
  const prefix = `${username}/`;
  let totalSize = 0;
  let fileCount = 0;
  const files: Array<{ key: string; size: number; lastModified?: Date }> = [];

  const primaryBucket = process.env.AWS_BUCKET!;
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: primaryBucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key && object.Size) {
          totalSize += object.Size;
          fileCount++;
          files.push({
            key: object.Key,
            size: object.Size,
            lastModified: object.LastModified,
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return { totalSize, fileCount, files };
}
