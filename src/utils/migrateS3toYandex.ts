import { ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

import s3Client from "./s3";
import yandexS3 from "./ys3";

const AWS_BUCKET = "korner-lol";
const YANDEX_BUCKET = "korner";

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function migrateAllObjects() {
  const listCommand = new ListObjectsV2Command({ Bucket: AWS_BUCKET });
  const listResponse = await s3Client.send(listCommand);

  if (!listResponse.Contents) {
    console.log("No objects found in AWS bucket");
    return;
  }

  for (const obj of listResponse.Contents) {
    const key = obj.Key!;
    console.log(`Migrating: ${key}`);

    const getCommand = new GetObjectCommand({ Bucket: AWS_BUCKET, Key: key });
    const awsObj = await s3Client.send(getCommand);
    const bodyBuffer = await streamToBuffer(awsObj.Body as Readable);

    const putCommand = new PutObjectCommand({
      Bucket: YANDEX_BUCKET,
      Key: key,
      Body: bodyBuffer,
      ContentType: awsObj.ContentType,
    });

    await yandexS3.send(putCommand);
    console.log(`Uploaded to Yandex: ${key}`);
  }

  console.log("Migration completed.");
}

migrateAllObjects().catch(console.error);
