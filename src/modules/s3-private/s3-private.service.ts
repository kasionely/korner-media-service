import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ERROR_CODES } from "../../utils/errorCodes";
import { generateSafeFilename } from "../../utils/file";
import s3Client from "../../utils/s3";

export class S3PrivateError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function getPrivateBucket(): string {
  return process.env.ACTIVE_ENV === "prod" ? "korner-pro-private" : "korner-lol-private";
}

function getCdnDomain(): string {
  return process.env.ACTIVE_ENV === "prod"
    ? "https://cdn-private.korner.pro"
    : "https://cdn-private.korner.lol";
}

class S3PrivateService {
  async generateUploadPresignedUrl(username: string, filename: string, mimetype: string) {
    if (!filename || !mimetype) {
      throw new S3PrivateError(ERROR_CODES.BAD_REQUEST, "Filename and mimetype are required", 400);
    }

    const outputFilename = generateSafeFilename(filename, mimetype);
    const s3Key = `${username}/${outputFilename}`;
    const cdnDomain = getCdnDomain();

    const command = new PutObjectCommand({
      Bucket: getPrivateBucket(),
      Key: s3Key,
      ContentType: mimetype,
      CacheControl: "public, max-age=31536000, immutable",
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return {
      presignedUrl,
      key: s3Key,
      url: `${cdnDomain}/${s3Key}`,
    };
  }

  async generateAccessPresignedUrl(key: string) {
    if (!key) {
      throw new S3PrivateError(ERROR_CODES.BAD_REQUEST, "File key is required", 400);
    }

    const command = new GetObjectCommand({ Bucket: getPrivateBucket(), Key: key });
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    const cdnDomain = getCdnDomain();
    const s3Url = new URL(presignedUrl);
    const queryParams = s3Url.search;

    return {
      presignedUrl: `${cdnDomain}/${key}${queryParams}`,
      expiresIn: 3600,
    };
  }

  async getFileMetadata(key: string) {
    if (!key) {
      throw new S3PrivateError(ERROR_CODES.BAD_REQUEST, "File key is required", 400);
    }

    try {
      const command = new HeadObjectCommand({ Bucket: getPrivateBucket(), Key: key });
      const response = await s3Client.send(command);

      return {
        key,
        metadata: {
          contentType: response.ContentType,
          contentLength: response.ContentLength,
          lastModified: response.LastModified,
          etag: response.ETag,
          cacheControl: response.CacheControl,
          contentEncoding: response.ContentEncoding,
          contentDisposition: response.ContentDisposition,
          metadata: response.Metadata,
        },
      };
    } catch (error: any) {
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        throw new S3PrivateError(ERROR_CODES.BARS_FILE_NOT_FOUND, "File not found", 404);
      }
      throw error;
    }
  }

  async deletePrivateFile(username: string, key: string) {
    if (!key) {
      throw new S3PrivateError(ERROR_CODES.BAD_REQUEST, "File key is required", 400);
    }

    if (!key.startsWith(`${username}/`)) {
      throw new S3PrivateError(ERROR_CODES.ACCESS_DENIED, "You do not have permission to delete this file", 403);
    }

    try {
      const headCommand = new HeadObjectCommand({ Bucket: getPrivateBucket(), Key: key });
      await s3Client.send(headCommand);
    } catch (error: any) {
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        throw new S3PrivateError(ERROR_CODES.FILE_NOT_FOUND, "File not found", 404);
      }
      throw error;
    }

    const deleteCommand = new DeleteObjectCommand({ Bucket: getPrivateBucket(), Key: key });
    await s3Client.send(deleteCommand);

    return { success: true, message: "File deleted successfully", key };
  }
}

export const s3PrivateService = new S3PrivateService();
