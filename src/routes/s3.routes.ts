import { GetObjectCommand } from "@aws-sdk/client-s3";
import cors from "cors";
import express, { Request, Response, Router } from "express";
import multer from "multer";
import { Readable } from "stream";

import { ERROR_CODES } from "../utils/errorCodes";
import { generateSafeFilename } from "../utils/file";
import { compressImage } from "../utils/imageCompressor";
import { verifyAccessToken } from "../utils/jwt";
import { getUserByToken } from "../utils/mainServiceClient";
import redis from "../utils/redis";
import {
  uploadToBothBuckets,
  deleteFromBothBuckets,
  streamToBuffer,
  cacheFileToRedis,
} from "../utils/s3.utils";
import yandexS3 from "../utils/ys3";

const router = Router();

const allowedOrigins = ["https://korner.pro", "https://korner.lol", "http://localhost:6969"];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
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

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const upload = multer({ storage: multer.memoryStorage() });

router.options("*", cors(corsOptions));

async function authorizeAndGetUsername(
  req: Request
): Promise<{ username?: string; error?: { code: string; message: string } }> {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return {
      error: { code: ERROR_CODES.BASE_AUTH_TOKEN_REQUIRED, message: "Authorization token required" },
    };
  }

  const decoded = verifyAccessToken(token);
  if (decoded.error) {
    return { error: { code: decoded.error.code, message: decoded.error.message } };
  }

  // Fetch user from korner-main-service
  const { user, error } = await getUserByToken(token);

  if (error === "not_found" || !user || !user.username) {
    return { error: { code: ERROR_CODES.PROFILE_NOTFOUND, message: "User profile not found" } };
  }

  if (error === "unauthorized") {
    return { error: { code: ERROR_CODES.AUTH_USER_NOT_EXIST, message: "User does not exist" } };
  }

  return { username: user.username };
}

router.post(
  "/upload/image",
  cors(corsOptions),
  upload.single("image"),
  async (req: Request & { file?: MulterFile }, res: Response): Promise<void> => {
    try {
      const authResult = await authorizeAndGetUsername(req);
      if (authResult.error) {
        res
          .status(authResult.error.code.startsWith("AUTH") ? 401 : 404)
          .json({ error: authResult.error });
        return;
      }

      const username = authResult.username!;
      if (!req.file) {
        res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "No image file provided" } });
        return;
      }

      const maxImageSize = 5 * 1024 * 1024;
      if (req.file.size > maxImageSize) {
        res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "Image file size exceeds 5 MB limit" } });
        return;
      }

      const allowedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedImageTypes.includes(req.file.mimetype)) {
        res.status(400).json({
          error: { code: ERROR_CODES.BARS_INVALID_FILE_TYPE, message: "Invalid image type. Allowed: JPEG, PNG, GIF, WEBP" },
        });
        return;
      }

      const compressed = await compressImage({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
      });

      const buffer = compressed.buffer;
      let outputFilename: string;
      let contentType: string;

      if (compressed.skipConversion) {
        outputFilename = generateSafeFilename(compressed.outputFilename, req.file.mimetype);
        contentType = req.file.mimetype;
      } else {
        outputFilename = generateSafeFilename(compressed.outputFilename, "image/webp");
        contentType = "image/webp";
      }

      const url = await uploadToBothBuckets(username, buffer, outputFilename, contentType);
      res.status(200).json({ message: "Image uploaded successfully", url });
    } catch (error) {
      console.error("Error processing image:", error);
      res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to process image" } });
    }
  }
);

router.post(
  "/upload/audio",
  cors(corsOptions),
  upload.single("audio"),
  async (req: Request & { file?: MulterFile }, res: Response): Promise<void> => {
    try {
      const authResult = await authorizeAndGetUsername(req);
      if (authResult.error) {
        res.status(authResult.error.code.startsWith("AUTH") ? 401 : 404).json({ error: authResult.error });
        return;
      }

      const username = authResult.username!;
      if (!req.file) {
        res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "No audio file provided" } });
        return;
      }

      const maxAudioSize = 100 * 1024 * 1024;
      if (req.file.size > maxAudioSize) {
        res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "Audio file size exceeds 100 MB limit" } });
        return;
      }

      const allowedAudioTypes = ["audio/mpeg", "audio/wav", "audio/wave"];
      if (!allowedAudioTypes.includes(req.file.mimetype)) {
        res.status(400).json({
          error: { code: ERROR_CODES.BARS_INVALID_FILE_TYPE, message: "Invalid audio type. Allowed: MP3, WAV" },
        });
        return;
      }

      const outputFilename = generateSafeFilename(req.file.originalname, req.file.mimetype);
      const url = await uploadToBothBuckets(username, req.file.buffer, outputFilename, req.file.mimetype);
      res.status(200).json({ message: "Audio uploaded successfully", url });
    } catch (error) {
      console.error("Error processing audio:", error);
      res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to process audio" } });
    }
  }
);

router.post(
  "/upload/video",
  cors(corsOptions),
  upload.single("video"),
  async (req: Request & { file?: MulterFile }, res: Response): Promise<void> => {
    try {
      const authResult = await authorizeAndGetUsername(req);
      if (authResult.error) {
        res.status(authResult.error.code.startsWith("AUTH") ? 401 : 404).json({ error: authResult.error });
        return;
      }

      const username = authResult.username!;
      if (!req.file) {
        res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "No video file provided" } });
        return;
      }

      const maxVideoSize = 100 * 1024 * 1024;
      if (req.file.size > maxVideoSize) {
        res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "Video file size exceeds 100 MB limit" } });
        return;
      }

      const allowedVideoTypes = ["video/mp4", "video/webm"];
      if (!allowedVideoTypes.includes(req.file.mimetype)) {
        res.status(400).json({
          error: { code: ERROR_CODES.BARS_INVALID_FILE_TYPE, message: "Invalid video type. Allowed: MP4, WEBM" },
        });
        return;
      }

      const outputFilename = generateSafeFilename(req.file.originalname, req.file.mimetype);
      const url = await uploadToBothBuckets(username, req.file.buffer, outputFilename, req.file.mimetype);
      res.status(200).json({ message: "Video uploaded successfully", url });
    } catch (error) {
      console.error("Error processing video:", error);
      res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to process video" } });
    }
  }
);

router.post(
  "/upload/file",
  cors(corsOptions),
  upload.single("file"),
  async (req: Request & { file?: MulterFile }, res: Response): Promise<void> => {
    try {
      const authResult = await authorizeAndGetUsername(req);
      if (authResult.error) {
        res.status(authResult.error.code.startsWith("AUTH") ? 401 : 404).json({ error: authResult.error });
        return;
      }

      const username = authResult.username!;
      if (!req.file) {
        res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "No file provided" } });
        return;
      }

      const maxFileSize = 15 * 1024 * 1024;
      if (req.file.size > maxFileSize) {
        res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "File size exceeds 15 MB limit" } });
        return;
      }

      const allowedTypes = [
        "application/pdf",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
      ];
      if (!allowedTypes.includes(req.file.mimetype)) {
        res.status(400).json({
          error: { code: ERROR_CODES.BARS_INVALID_FILE_TYPE, message: "Invalid file type. Allowed: PDF, XLS, XLSX, CSV" },
        });
        return;
      }

      const outputFilename = generateSafeFilename(req.file.originalname, req.file.mimetype);
      const url = await uploadToBothBuckets(username, req.file.buffer, outputFilename, req.file.mimetype);
      res.status(200).json({ message: "File uploaded successfully", url });
    } catch (error) {
      console.error("Error processing file:", error);
      res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to process file" } });
    }
  }
);

router.get("/:key", async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const cacheKey = `file:${key}`;
    const metadataKey = `metadata:${key}`;

    const cached = await redis.getBuffer(cacheKey);
    if (cached) {
      const cachedMetadata = await redis.hgetall(metadataKey);
      if (cachedMetadata?.ContentType) {
        res.setHeader("Content-Type", cachedMetadata.ContentType);
        if (cachedMetadata.ContentLength) res.setHeader("Content-Length", cachedMetadata.ContentLength);
        if (cachedMetadata.LastModified) res.setHeader("Last-Modified", cachedMetadata.LastModified);
        res.setHeader("Cache-Control", "public, max-age=31536000");
        res.end(cached);
        return;
      }
    }

    const bucketName = process.env.ACTIVE_ENV === "prod" ? "korner-pro" : "korner-lol";
    const command = new GetObjectCommand({ Bucket: bucketName, Key: decodeURIComponent(key) });
    const { Body, ContentType, ContentLength, LastModified } = await yandexS3.send(command);

    if (!Body) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const buffer = await streamToBuffer(Body as Readable);

    res.setHeader("Content-Type", ContentType || "application/octet-stream");
    res.setHeader("Content-Length", ContentLength?.toString() || buffer.length.toString());
    if (LastModified) res.setHeader("Last-Modified", LastModified.toUTCString());
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.end(buffer);

    void cacheFileToRedis(key, buffer, ContentType, ContentLength, LastModified);
  } catch (error) {
    console.error("Error retrieving file:", error);
    res.status(500).json({ error: "Failed to retrieve file" });
  }
});

router.get(
  "/:username/:filename",
  async (req: Request<{ username: string; filename: string }>, res: Response): Promise<void> => {
    try {
      const { username, filename } = req.params;

      if (!filename || /[^\w\-._~]/.test(filename)) {
        res.status(400).json({ error: { code: ERROR_CODES.BARS_INVALID_INPUT, message: "Invalid filename" } });
        return;
      }

      const key = `${username}/${filename}`;
      const bucketName = process.env.ACTIVE_ENV === "prod" ? "korner-pro" : "korner-lol";
      const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
      const { Body, ContentType, ContentLength, LastModified } = await yandexS3.send(command);

      if (!Body) {
        res.status(404).json({ error: { code: ERROR_CODES.BARS_FILE_NOT_FOUND, message: "File not found" } });
        return;
      }

      res.setHeader("Content-Type", ContentType || "application/octet-stream");
      if (ContentLength) res.setHeader("Content-Length", ContentLength.toString());
      if (LastModified) res.setHeader("Last-Modified", LastModified.toUTCString());
      res.setHeader("Cache-Control", "public, max-age=31536000");
      (Body as any).pipe(res);
    } catch (error) {
      console.error("Error streaming file:", error);
      res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to retrieve file" } });
    }
  }
);

router.delete(
  "/delete",
  cors(corsOptions),
  express.json({ limit: "50mb" }),
  async (req: Request<{}, {}, { url: string }>, res: Response): Promise<void> => {
    try {
      const authResult = await authorizeAndGetUsername(req);
      if (authResult.error) {
        res.status(authResult.error.code.startsWith("AUTH") ? 401 : 404).json({ error: authResult.error });
        return;
      }

      const username = authResult.username!;
      const { url } = req.body;

      if (!url || typeof url !== "string") {
        res.status(400).json({ error: { code: ERROR_CODES.BARS_INVALID_INPUT, message: "URL must be a non-empty string" } });
        return;
      }

      let key;
      try {
        const urlObj = new URL(url);
        key = urlObj.pathname.replace(/^\//, "");
      } catch {
        res.status(400).json({ error: { code: ERROR_CODES.BARS_INVALID_INPUT, message: "Invalid URL format" } });
        return;
      }

      if (!key || !key.startsWith(`${username}/`)) {
        res.status(403).json({
          error: { code: ERROR_CODES.BARS_ACCESS_DENIED, message: "You can only delete files from your own directory" },
        });
        return;
      }

      await deleteFromBothBuckets(username, key);
      res.status(200).json({ message: "File deleted successfully", key });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to delete file" } });
    }
  }
);

export default router;
