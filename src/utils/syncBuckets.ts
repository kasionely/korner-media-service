import {
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

import yandexS3 from "./ys3";

const SOURCE_BUCKET = "korner";
const TARGET_BUCKETS = ["korner-lol", "korner-pro"];

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function syncBuckets() {
  console.log(`Starting sync from bucket "${SOURCE_BUCKET}"`);

  let continuationToken: string | undefined;
  let totalFiles = 0;
  let syncedFiles = 0;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: SOURCE_BUCKET,
      ContinuationToken: continuationToken,
      MaxKeys: 100,
    });

    const listResponse = await yandexS3.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      if (totalFiles === 0) {
        console.log("No objects found in source bucket");
        return;
      }
      break;
    }

    totalFiles += listResponse.Contents.length;

    for (const obj of listResponse.Contents) {
      const key = obj.Key!;

      try {
        const getCommand = new GetObjectCommand({ Bucket: SOURCE_BUCKET, Key: key });
        const sourceObj = await yandexS3.send(getCommand);
        const bodyBuffer = await streamToBuffer(sourceObj.Body as Readable);

        for (const targetBucket of TARGET_BUCKETS) {
          try {
            const putCommand = new PutObjectCommand({
              Bucket: targetBucket,
              Key: key,
              Body: bodyBuffer,
              ContentType: sourceObj.ContentType,
              CacheControl: sourceObj.CacheControl,
              ContentEncoding: sourceObj.ContentEncoding,
              ContentLanguage: sourceObj.ContentLanguage,
              ContentDisposition: sourceObj.ContentDisposition,
              Metadata: sourceObj.Metadata,
            });
            await yandexS3.send(putCommand);
          } catch (error) {
            console.error(`Error copying to ${targetBucket}: ${key}`, error);
          }
        }

        syncedFiles++;
      } catch (error) {
        console.error(`Error fetching file ${key}:`, error);
      }
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  console.log(`Sync completed: ${syncedFiles}/${totalFiles} files`);
}

async function syncUserFolder(username: string) {
  const prefix = `${username}/`;
  let continuationToken: string | undefined;
  let totalFiles = 0;
  let syncedFiles = 0;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: SOURCE_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 100,
    });

    const listResponse = await yandexS3.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      if (totalFiles === 0) console.log(`No files found for user ${username}`);
      break;
    }

    totalFiles += listResponse.Contents.length;

    for (const obj of listResponse.Contents) {
      const key = obj.Key!;
      try {
        const getCommand = new GetObjectCommand({ Bucket: SOURCE_BUCKET, Key: key });
        const sourceObj = await yandexS3.send(getCommand);
        const bodyBuffer = await streamToBuffer(sourceObj.Body as Readable);

        for (const targetBucket of TARGET_BUCKETS) {
          try {
            const putCommand = new PutObjectCommand({
              Bucket: targetBucket,
              Key: key,
              Body: bodyBuffer,
              ContentType: sourceObj.ContentType,
              CacheControl: sourceObj.CacheControl,
            });
            await yandexS3.send(putCommand);
          } catch (error) {
            console.error(`Error copying to ${targetBucket}: ${key}`, error);
          }
        }
        syncedFiles++;
      } catch (error) {
        console.error(`Error fetching file ${key}:`, error);
      }
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  console.log(`User sync completed: ${syncedFiles}/${totalFiles} files`);
}

export { syncBuckets, syncUserFolder };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 0 && args[0] === "--user" && args[1]) {
    syncUserFolder(args[1]).catch(console.error);
  } else {
    syncBuckets().catch(console.error);
  }
}
