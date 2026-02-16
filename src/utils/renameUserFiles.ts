import {
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

import s3Client from "./s3";
import yandexS3 from "./ys3";

interface RenameResult {
  success: boolean;
  filesRenamed: number;
  errors: string[];
}

export async function renameUserFilesInAllBuckets(
  oldUsername: string,
  newUsername: string
): Promise<RenameResult> {
  const errors: string[] = [];
  let totalFilesRenamed = 0;

  const isProd = process.env.ACTIVE_ENV === "prod";

  const buckets = [
    { name: "AWS S3 Public", client: s3Client, bucket: isProd ? "korner-pro" : "korner-lol" },
    { name: "AWS S3 Private", client: s3Client, bucket: isProd ? "korner-pro-private" : "korner-lol-private" },
    { name: "Yandex S3 Public", client: yandexS3, bucket: isProd ? "korner-pro" : "korner-lol" },
  ];

  for (const { name, client, bucket } of buckets) {
    try {
      const result = await renameFilesInBucket(client, bucket, oldUsername, newUsername);
      totalFilesRenamed += result.filesRenamed;
      if (result.errors.length > 0) errors.push(`${name}: ${result.errors.join(", ")}`);
    } catch (error) {
      const errorMessage = `Failed to process ${name}: ${(error as Error).message}`;
      errors.push(errorMessage);
      console.error(errorMessage);
    }
  }

  return { success: errors.length === 0, filesRenamed: totalFilesRenamed, errors };
}

async function renameFilesInBucket(
  client: any,
  bucket: string,
  oldUsername: string,
  newUsername: string
): Promise<{ filesRenamed: number; errors: string[] }> {
  const prefix = `${oldUsername}/`;
  const errors: string[] = [];
  let filesRenamed = 0;
  let continuationToken: string | undefined;

  do {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const listResponse = await client.send(listCommand);
      if (!listResponse.Contents || listResponse.Contents.length === 0) break;

      for (const object of listResponse.Contents) {
        if (!object.Key) continue;

        const oldKey = object.Key;
        const newKey = oldKey.replace(`${oldUsername}/`, `${newUsername}/`);

        try {
          const headCommand = new HeadObjectCommand({ Bucket: bucket, Key: oldKey });
          const headResponse = await client.send(headCommand);

          const copyCommand = new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${oldKey}`,
            Key: newKey,
            ContentType: headResponse.ContentType,
            CacheControl: headResponse.CacheControl,
            Metadata: headResponse.Metadata,
          });
          await client.send(copyCommand);

          const deleteCommand = new DeleteObjectCommand({ Bucket: bucket, Key: oldKey });
          await client.send(deleteCommand);

          filesRenamed++;
        } catch (error) {
          const errorMessage = `Failed to rename ${oldKey}: ${(error as Error).message}`;
          errors.push(errorMessage);
          console.error(errorMessage);
        }
      }

      continuationToken = listResponse.NextContinuationToken;
    } catch (error) {
      errors.push(`Failed to list objects in ${bucket}: ${(error as Error).message}`);
      break;
    }
  } while (continuationToken);

  return { filesRenamed, errors };
}
