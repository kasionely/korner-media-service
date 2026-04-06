import { z } from "zod";

import { errorResponse } from "../../schemas/response.schema";

// --- Response Schemas ---

export const generateUploadPresignedUrlResponse = z.object({
  presignedUrl: z.string(),
  key: z.string(),
  url: z.string(),
});

export const generateAccessPresignedUrlResponse = z.object({
  presignedUrl: z.string(),
  expiresIn: z.number(),
});

export const getFileMetadataResponse = z.object({
  key: z.string(),
  metadata: z.object({
    contentType: z.string().optional(),
    contentLength: z.number().optional(),
    lastModified: z.unknown().optional(),
    etag: z.string().optional(),
    cacheControl: z.string().optional(),
    contentEncoding: z.string().optional(),
    contentDisposition: z.string().optional(),
    metadata: z.record(z.string()).optional(),
  }),
});

export const deletePrivateFileResponse = z.object({
  success: z.literal(true),
  message: z.string(),
  key: z.string(),
});

export const s3PrivateErrorResponse = errorResponse;
