import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

import s3Client from "./s3";

interface FileTransferResult {
  success: boolean;
  error?: string;
  movedFiles?: string[];
  updatedDetails?: any;
  updatedThumbnail?: string | null;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function extractFileUrlsFromBarDetails(details: any, type: string): string[] {
  const urls: string[] = [];
  if (!details) return urls;

  switch (type) {
    case "Video":
      if (details.videoUrl && isMonetizableFile(details.videoUrl)) urls.push(details.videoUrl);
      break;
    case "Audio":
      if (details.audioUrl && isMonetizableFile(details.audioUrl)) urls.push(details.audioUrl);
      break;
    case "File":
      if (details.fileUrl && isMonetizableFile(details.fileUrl)) urls.push(details.fileUrl);
      break;
    case "Text":
      if (details.backgroundImageUrl) urls.push(details.backgroundImageUrl);
      break;
  }

  return urls.filter((url) => url && typeof url === "string");
}

function isMonetizableFile(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  const mediaExtensions = [
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff",
    ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".mkv", ".m4v",
    ".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".m4a", ".opus",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf",
    ".zip", ".rar", ".7z", ".tar", ".gz",
  ];
  return mediaExtensions.some((ext) => lowerUrl.includes(ext));
}

export function extractS3KeyFromUrl(url: string): string | null {
  try {
    const patterns = [
      /https:\/\/cdn\.korner\.pro\/(.+)$/,
      /https:\/\/cdn\.korner\.lol\/(.+)$/,
      /https:\/\/cdn-private\.korner\.pro\/(.+)$/,
      /https:\/\/cdn-private\.korner\.lol\/(.+)$/,
      /https:\/\/korner-pro\.s3\..+\.amazonaws\.com\/(.+)$/,
      /https:\/\/korner-lol\.s3\..+\.amazonaws\.com\/(.+)$/,
      /https:\/\/korner-pro-private\.s3\..+\.amazonaws\.com\/(.+)$/,
      /https:\/\/korner-lol-private\.s3\..+\.amazonaws\.com\/(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  } catch (error) {
    console.error("Error extracting S3 key from URL:", error);
    return null;
  }
}

async function moveFileToPrivateBucket(
  publicKey: string,
  privateKey: string,
  publicBucket: string,
  privateBucket: string
): Promise<boolean> {
  try {
    const headCommand = new HeadObjectCommand({ Bucket: publicBucket, Key: publicKey });
    let fileMetadata;
    try {
      fileMetadata = await s3Client.send(headCommand);
    } catch (error: any) {
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) return false;
      throw error;
    }

    const getCommand = new GetObjectCommand({ Bucket: publicBucket, Key: publicKey });
    const sourceObj = await s3Client.send(getCommand);
    const bodyBuffer = await streamToBuffer(sourceObj.Body as Readable);

    const putCommand = new PutObjectCommand({
      Bucket: privateBucket,
      Key: privateKey,
      Body: bodyBuffer,
      ContentType: fileMetadata.ContentType,
      CacheControl: fileMetadata.CacheControl || "public, max-age=31536000, immutable",
      ContentEncoding: fileMetadata.ContentEncoding,
      ContentLanguage: fileMetadata.ContentLanguage,
      ContentDisposition: fileMetadata.ContentDisposition,
      Metadata: fileMetadata.Metadata,
    });
    await s3Client.send(putCommand);

    const deleteCommand = new DeleteObjectCommand({ Bucket: publicBucket, Key: publicKey });
    await s3Client.send(deleteCommand);

    console.log(`Successfully moved file: ${publicKey} -> ${privateKey}`);
    return true;
  } catch (error) {
    console.error(`Error moving file ${publicKey}:`, error);
    return false;
  }
}

function updateUrlsInBarDetails(details: any, type: string, urlMapping: Map<string, string>): any {
  if (!details) return details;

  const updatedDetails = { ...details };
  const updateUrl = (url: string): string => urlMapping.get(url) || url;

  switch (type) {
    case "Video":
      if (updatedDetails.videoUrl) updatedDetails.videoUrl = updateUrl(updatedDetails.videoUrl);
      break;
    case "Audio":
      if (updatedDetails.audioUrl) updatedDetails.audioUrl = updateUrl(updatedDetails.audioUrl);
      break;
    case "File":
      if (updatedDetails.fileUrl) updatedDetails.fileUrl = updateUrl(updatedDetails.fileUrl);
      break;
    case "Text":
      if (updatedDetails.backgroundImageUrl) {
        updatedDetails.backgroundImageUrl = updateUrl(updatedDetails.backgroundImageUrl);
      }
      break;
  }

  return updatedDetails;
}

export async function moveBarFilesToPrivateBucket(
  barId: string,
  barType: string,
  barDetails: any,
  thumbnail?: string | null
): Promise<FileTransferResult> {
  try {
    const publicBucket = process.env.ACTIVE_ENV === "prod" ? "korner-pro" : "korner-lol";
    const privateBucket =
      process.env.ACTIVE_ENV === "prod" ? "korner-pro-private" : "korner-lol-private";

    const fileUrls = extractFileUrlsFromBarDetails(barDetails, barType);
    if (thumbnail && typeof thumbnail === "string") fileUrls.push(thumbnail);

    if (fileUrls.length === 0) return { success: true, movedFiles: [] };

    const urlMapping = new Map<string, string>();
    const movedFiles: string[] = [];

    for (const url of fileUrls) {
      const s3Key = extractS3KeyFromUrl(url);
      if (!s3Key) continue;

      const moved = await moveFileToPrivateBucket(s3Key, s3Key, publicBucket, privateBucket);

      if (moved) {
        const privateCdnDomain =
          process.env.ACTIVE_ENV === "prod"
            ? "https://cdn-private.korner.pro"
            : "https://cdn-private.korner.lol";

        urlMapping.set(url, `${privateCdnDomain}/${s3Key}`);
        movedFiles.push(s3Key);
      }
    }

    const updatedDetails = updateUrlsInBarDetails(barDetails, barType, urlMapping);

    return {
      success: true,
      movedFiles,
      updatedDetails,
      updatedThumbnail: (thumbnail && urlMapping.get(thumbnail)) || thumbnail,
    };
  } catch (error) {
    console.error(`Error transferring files for bar ${barId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

export function getMainContentFileKey(
  barType: string,
  details: any,
  movedFilesCount?: number
): string | null {
  if (!details || !movedFilesCount || movedFilesCount === 0) return null;

  let mainFileUrl: string | null = null;

  switch (barType) {
    case "Video":
      mainFileUrl = details.videoUrl || null;
      break;
    case "Audio":
      mainFileUrl = details.audioUrl || null;
      break;
    case "File":
      mainFileUrl = details.fileUrl || null;
      break;
    default:
      return null;
  }

  if (!mainFileUrl) return null;
  return extractS3KeyFromUrl(mainFileUrl);
}
