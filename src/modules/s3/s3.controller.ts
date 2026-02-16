import { Request, Response } from "express";

import { S3Error, authorizeAndGetUsername, s3Service } from "./s3.service";
import { ERROR_CODES } from "../../utils/errorCodes";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

function handleError(error: unknown, res: Response, logPrefix: string) {
  if (error instanceof S3Error) {
    return res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
  }
  console.error(`${logPrefix}:`, error);
  return res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Internal server error" } });
}

async function getAuthorizedUsername(
  req: Request,
  res: Response
): Promise<string | null> {
  const token = req.headers.authorization?.split(" ")[1];
  const authResult = await authorizeAndGetUsername(token);
  if (authResult.error) {
    const statusCode = authResult.error.code.startsWith("AUTH") ? 401 : 404;
    res.status(statusCode).json({ error: authResult.error });
    return null;
  }
  return authResult.username!;
}

export async function uploadImage(req: MulterRequest, res: Response): Promise<void> {
  try {
    const username = await getAuthorizedUsername(req, res);
    if (!username) return;

    if (!req.file) {
      res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "No image file provided" } });
      return;
    }

    const result = await s3Service.uploadImage(username, req.file);
    res.status(200).json(result);
  } catch (error) {
    handleError(error, res, "Error processing image");
  }
}

export async function uploadAudio(req: MulterRequest, res: Response): Promise<void> {
  try {
    const username = await getAuthorizedUsername(req, res);
    if (!username) return;

    if (!req.file) {
      res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "No audio file provided" } });
      return;
    }

    const result = await s3Service.uploadAudio(username, req.file);
    res.status(200).json(result);
  } catch (error) {
    handleError(error, res, "Error processing audio");
  }
}

export async function uploadVideo(req: MulterRequest, res: Response): Promise<void> {
  try {
    const username = await getAuthorizedUsername(req, res);
    if (!username) return;

    if (!req.file) {
      res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "No video file provided" } });
      return;
    }

    const result = await s3Service.uploadVideo(username, req.file);
    res.status(200).json(result);
  } catch (error) {
    handleError(error, res, "Error processing video");
  }
}

export async function uploadFile(req: MulterRequest, res: Response): Promise<void> {
  try {
    const username = await getAuthorizedUsername(req, res);
    if (!username) return;

    if (!req.file) {
      res.status(400).json({ error: { code: ERROR_CODES.BAD_REQUEST, message: "No file provided" } });
      return;
    }

    const result = await s3Service.uploadFile(username, req.file);
    res.status(200).json(result);
  } catch (error) {
    handleError(error, res, "Error processing file");
  }
}

export async function getFile(req: Request, res: Response): Promise<void> {
  try {
    const { key } = req.params;
    const result = await s3Service.getFile(key);

    res.setHeader("Content-Type", result.metadata.ContentType as string);
    if (result.metadata.ContentLength) res.setHeader("Content-Length", result.metadata.ContentLength as string);
    if (result.metadata.LastModified) res.setHeader("Last-Modified", result.metadata.LastModified as string);
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.end(result.buffer);
  } catch (error) {
    if (error instanceof S3Error && error.statusCode === 404) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    console.error("Error retrieving file:", error);
    res.status(500).json({ error: "Failed to retrieve file" });
  }
}

export async function getFileByPath(req: Request<{ username: string; filename: string }>, res: Response): Promise<void> {
  try {
    const { username, filename } = req.params;
    const result = await s3Service.getFileByPath(username, filename);

    res.setHeader("Content-Type", result.ContentType || "application/octet-stream");
    if (result.ContentLength) res.setHeader("Content-Length", result.ContentLength.toString());
    if (result.LastModified) res.setHeader("Last-Modified", result.LastModified.toUTCString());
    res.setHeader("Cache-Control", "public, max-age=31536000");
    (result.Body as any).pipe(res);
  } catch (error) {
    handleError(error, res, "Error streaming file");
  }
}

export async function deleteFile(req: Request<{}, {}, { url: string }>, res: Response): Promise<void> {
  try {
    const username = await getAuthorizedUsername(req, res);
    if (!username) return;

    const result = await s3Service.deleteFile(username, req.body.url);
    res.status(200).json(result);
  } catch (error) {
    handleError(error, res, "Error deleting file");
  }
}
