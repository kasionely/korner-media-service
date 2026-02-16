import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

import { ERROR_CODES } from "../../utils/errorCodes";
import { generateSafeFilename } from "../../utils/file";
import { compressImage } from "../../utils/imageCompressor";
import { verifyAccessToken } from "../../utils/jwt";
import { getUserByToken } from "../../utils/mainServiceClient";
import redis from "../../utils/redis";
import { cacheFileToRedis, deleteFromBothBuckets, streamToBuffer, uploadToBothBuckets } from "../../utils/s3.utils";
import yandexS3 from "../../utils/ys3";

export class S3Error extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export async function authorizeAndGetUsername(
  token: string | undefined
): Promise<{ username?: string; error?: { code: string; message: string } }> {
  if (!token) {
    return { error: { code: ERROR_CODES.BASE_AUTH_TOKEN_REQUIRED, message: "Authorization token required" } };
  }

  const decoded = verifyAccessToken(token);
  if (decoded.error) {
    return { error: { code: decoded.error.code, message: decoded.error.message } };
  }

  const { user, error } = await getUserByToken(token);

  if (error === "not_found" || !user || !user.username) {
    return { error: { code: ERROR_CODES.PROFILE_NOTFOUND, message: "User profile not found" } };
  }

  if (error === "unauthorized") {
    return { error: { code: ERROR_CODES.AUTH_USER_NOT_EXIST, message: "User does not exist" } };
  }

  return { username: user.username };
}

class S3Service {
  async uploadImage(username: string, file: MulterFile) {
    const maxImageSize = 5 * 1024 * 1024;
    if (file.size > maxImageSize) {
      throw new S3Error(ERROR_CODES.BAD_REQUEST, "Image file size exceeds 5 MB limit", 400);
    }

    const allowedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedImageTypes.includes(file.mimetype)) {
      throw new S3Error(ERROR_CODES.BARS_INVALID_FILE_TYPE, "Invalid image type. Allowed: JPEG, PNG, GIF, WEBP", 400);
    }

    const compressed = await compressImage({
      buffer: file.buffer,
      filename: file.originalname,
      mimetype: file.mimetype,
    });

    const buffer = compressed.buffer;
    const outputFilename = generateSafeFilename(
      compressed.outputFilename,
      compressed.skipConversion ? file.mimetype : "image/webp"
    );
    const contentType = compressed.skipConversion ? file.mimetype : "image/webp";

    const url = await uploadToBothBuckets(username, buffer, outputFilename, contentType);
    return { message: "Image uploaded successfully", url };
  }

  async uploadAudio(username: string, file: MulterFile) {
    const maxAudioSize = 100 * 1024 * 1024;
    if (file.size > maxAudioSize) {
      throw new S3Error(ERROR_CODES.BAD_REQUEST, "Audio file size exceeds 100 MB limit", 400);
    }

    const allowedAudioTypes = ["audio/mpeg", "audio/wav", "audio/wave"];
    if (!allowedAudioTypes.includes(file.mimetype)) {
      throw new S3Error(ERROR_CODES.BARS_INVALID_FILE_TYPE, "Invalid audio type. Allowed: MP3, WAV", 400);
    }

    const outputFilename = generateSafeFilename(file.originalname, file.mimetype);
    const url = await uploadToBothBuckets(username, file.buffer, outputFilename, file.mimetype);
    return { message: "Audio uploaded successfully", url };
  }

  async uploadVideo(username: string, file: MulterFile) {
    const maxVideoSize = 100 * 1024 * 1024;
    if (file.size > maxVideoSize) {
      throw new S3Error(ERROR_CODES.BAD_REQUEST, "Video file size exceeds 100 MB limit", 400);
    }

    const allowedVideoTypes = ["video/mp4", "video/webm"];
    if (!allowedVideoTypes.includes(file.mimetype)) {
      throw new S3Error(ERROR_CODES.BARS_INVALID_FILE_TYPE, "Invalid video type. Allowed: MP4, WEBM", 400);
    }

    const outputFilename = generateSafeFilename(file.originalname, file.mimetype);
    const url = await uploadToBothBuckets(username, file.buffer, outputFilename, file.mimetype);
    return { message: "Video uploaded successfully", url };
  }

  async uploadFile(username: string, file: MulterFile) {
    const maxFileSize = 15 * 1024 * 1024;
    if (file.size > maxFileSize) {
      throw new S3Error(ERROR_CODES.BAD_REQUEST, "File size exceeds 15 MB limit", 400);
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new S3Error(ERROR_CODES.BARS_INVALID_FILE_TYPE, "Invalid file type. Allowed: PDF, XLS, XLSX, CSV", 400);
    }

    const outputFilename = generateSafeFilename(file.originalname, file.mimetype);
    const url = await uploadToBothBuckets(username, file.buffer, outputFilename, file.mimetype);
    return { message: "File uploaded successfully", url };
  }

  async getFile(key: string) {
    const cacheKey = `file:${key}`;
    const metadataKey = `metadata:${key}`;

    const cached = await redis.getBuffer(cacheKey);
    if (cached) {
      const cachedMetadata = await redis.hgetall(metadataKey);
      if (cachedMetadata?.ContentType) {
        return { buffer: cached, metadata: cachedMetadata, fromCache: true };
      }
    }

    const bucketName = process.env.ACTIVE_ENV === "prod" ? "korner-pro" : "korner-lol";
    const command = new GetObjectCommand({ Bucket: bucketName, Key: decodeURIComponent(key) });
    const { Body, ContentType, ContentLength, LastModified } = await yandexS3.send(command);

    if (!Body) {
      throw new S3Error("FILE_NOT_FOUND", "File not found", 404);
    }

    const buffer = await streamToBuffer(Body as Readable);

    void cacheFileToRedis(key, buffer, ContentType, ContentLength, LastModified);

    return {
      buffer,
      metadata: {
        ContentType: ContentType || "application/octet-stream",
        ContentLength: ContentLength?.toString() || buffer.length.toString(),
        LastModified: LastModified?.toUTCString(),
      },
      fromCache: false,
    };
  }

  async getFileByPath(username: string, filename: string) {
    if (!filename || /[^\w\-._~]/.test(filename)) {
      throw new S3Error(ERROR_CODES.BARS_INVALID_INPUT, "Invalid filename", 400);
    }

    const key = `${username}/${filename}`;
    const bucketName = process.env.ACTIVE_ENV === "prod" ? "korner-pro" : "korner-lol";
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const { Body, ContentType, ContentLength, LastModified } = await yandexS3.send(command);

    if (!Body) {
      throw new S3Error(ERROR_CODES.BARS_FILE_NOT_FOUND, "File not found", 404);
    }

    return { Body, ContentType, ContentLength, LastModified };
  }

  async deleteFile(username: string, url: string) {
    if (!url || typeof url !== "string") {
      throw new S3Error(ERROR_CODES.BARS_INVALID_INPUT, "URL must be a non-empty string", 400);
    }

    let key: string;
    try {
      const urlObj = new URL(url);
      key = urlObj.pathname.replace(/^\//, "");
    } catch {
      throw new S3Error(ERROR_CODES.BARS_INVALID_INPUT, "Invalid URL format", 400);
    }

    if (!key || !key.startsWith(`${username}/`)) {
      throw new S3Error(ERROR_CODES.BARS_ACCESS_DENIED, "You can only delete files from your own directory", 403);
    }

    await deleteFromBothBuckets(username, key);
    return { message: "File deleted successfully", key };
  }
}

export const s3Service = new S3Service();
