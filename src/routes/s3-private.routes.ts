import {
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import cors from "cors";
import { Response, Router } from "express";

import {
  authenticateUser,
  requireSubscription,
  checkContentAccess,
  AuthenticatedRequest,
  SubscriptionRequest,
} from "../middleware/subscription.middleware";
import { ERROR_CODES } from "../utils/errorCodes";
import { generateSafeFilename } from "../utils/file";
import s3Client from "../utils/s3";

const router = Router();

const allowedOrigins = ["https://korner.pro", "https://korner.lol", "http://localhost:6969"];

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void
  ) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

router.options("*", cors(corsOptions));

router.post(
  "/upload/private/presigned-url",
  cors(corsOptions),
  authenticateUser,
  requireSubscription,
  async (req: SubscriptionRequest, res: Response): Promise<void> => {
    try {
      const { filename, mimetype } = req.body;

      if (!filename || !mimetype) {
        res.status(400).json({
          error: { code: ERROR_CODES.BAD_REQUEST, message: "Filename and mimetype are required" },
        });
        return;
      }

      const outputFilename = generateSafeFilename(filename, mimetype);
      const s3Key = `${req.user!.username}/${outputFilename}`;

      const privateBucketName =
        process.env.ACTIVE_ENV === "prod" ? "korner-pro-private" : "korner-lol-private";
      const command = new PutObjectCommand({
        Bucket: privateBucketName,
        Key: s3Key,
        ContentType: mimetype,
        CacheControl: "public, max-age=31536000, immutable",
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      const cdnDomain =
        process.env.ACTIVE_ENV === "prod"
          ? "https://cdn-private.korner.pro"
          : "https://cdn-private.korner.lol";

      res.status(200).json({
        presignedUrl,
        key: s3Key,
        url: `${cdnDomain}/${s3Key}`,
      });
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      res.status(500).json({
        error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to generate presigned URL" },
      });
    }
  }
);

router.post(
  "/access/presigned-url",
  cors(corsOptions),
  authenticateUser,
  checkContentAccess,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { key } = req.body;

      if (!key) {
        res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "File key is required" } });
        return;
      }

      const privateBucketName =
        process.env.ACTIVE_ENV === "prod" ? "korner-pro-private" : "korner-lol-private";
      const command = new GetObjectCommand({ Bucket: privateBucketName, Key: key });
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      const cdnDomain =
        process.env.ACTIVE_ENV === "prod"
          ? "https://cdn-private.korner.pro"
          : "https://cdn-private.korner.lol";

      const s3Url = new URL(presignedUrl);
      const queryParams = s3Url.search;

      res.status(200).json({
        presignedUrl: `${cdnDomain}/${key}${queryParams}`,
        expiresIn: 3600,
      });
    } catch (error) {
      console.error("Error generating access presigned URL:", error);
      res.status(500).json({
        error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to generate access URL" },
      });
    }
  }
);

router.get(
  "/metadata/:key(*)",
  cors(corsOptions),
  authenticateUser,
  checkContentAccess,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { key } = req.params;

      if (!key) {
        res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "File key is required" } });
        return;
      }

      const privateBucketName =
        process.env.ACTIVE_ENV === "prod" ? "korner-pro-private" : "korner-lol-private";
      const command = new HeadObjectCommand({ Bucket: privateBucketName, Key: key });
      const response = await s3Client.send(command);

      res.status(200).json({
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
      });
    } catch (error: any) {
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        res.status(404).json({ error: { code: ERROR_CODES.BARS_FILE_NOT_FOUND, message: "File not found" } });
        return;
      }
      console.error("Error retrieving file metadata:", error);
      res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to retrieve file metadata" } });
    }
  }
);

router.delete(
  "/delete",
  cors(corsOptions),
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const key = req.query.key as string;

      if (!key) {
        res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "File key is required" } });
        return;
      }

      const userPrefix = `${req.user!.username}/`;
      if (!key.startsWith(userPrefix)) {
        res.status(403).json({
          error: { code: ERROR_CODES.ACCESS_DENIED, message: "You do not have permission to delete this file" },
        });
        return;
      }

      const privateBucketName =
        process.env.ACTIVE_ENV === "prod" ? "korner-pro-private" : "korner-lol-private";

      try {
        const headCommand = new HeadObjectCommand({ Bucket: privateBucketName, Key: key });
        await s3Client.send(headCommand);
      } catch (error: any) {
        if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
          res.status(404).json({ error: { code: ERROR_CODES.FILE_NOT_FOUND, message: "File not found" } });
          return;
        }
        throw error;
      }

      const deleteCommand = new DeleteObjectCommand({ Bucket: privateBucketName, Key: key });
      await s3Client.send(deleteCommand);

      res.status(200).json({ success: true, message: "File deleted successfully", key });
    } catch (error: any) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to delete file" } });
    }
  }
);

export default router;
