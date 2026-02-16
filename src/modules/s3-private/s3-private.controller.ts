import { Response } from "express";

import { S3PrivateError, s3PrivateService } from "./s3-private.service";
import {
  AuthenticatedRequest,
  SubscriptionRequest,
} from "../../middleware/subscription.middleware";
import { ERROR_CODES } from "../../utils/errorCodes";

function handleError(error: unknown, res: Response, logPrefix: string) {
  if (error instanceof S3PrivateError) {
    return res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
  }
  console.error(`${logPrefix}:`, error);
  return res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Internal server error" } });
}

export async function generateUploadPresignedUrl(req: SubscriptionRequest, res: Response): Promise<void> {
  try {
    const { filename, mimetype } = req.body;
    const result = await s3PrivateService.generateUploadPresignedUrl(req.user!.username, filename, mimetype);
    res.status(200).json(result);
  } catch (error) {
    handleError(error, res, "Error generating presigned URL");
  }
}

export async function generateAccessPresignedUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { key } = req.body;
    const result = await s3PrivateService.generateAccessPresignedUrl(key);
    res.status(200).json(result);
  } catch (error) {
    handleError(error, res, "Error generating access presigned URL");
  }
}

export async function getFileMetadata(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { key } = req.params;
    const result = await s3PrivateService.getFileMetadata(key);
    res.status(200).json(result);
  } catch (error) {
    handleError(error, res, "Error retrieving file metadata");
  }
}

export async function deletePrivateFile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const key = req.query.key as string;
    const result = await s3PrivateService.deletePrivateFile(req.user!.username, key);
    res.status(200).json(result);
  } catch (error) {
    handleError(error, res, "Error deleting file");
  }
}
