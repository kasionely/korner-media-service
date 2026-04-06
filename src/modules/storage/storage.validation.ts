import { z } from "zod";

import { errorResponse } from "../../schemas/response.schema";

// --- Response Schemas ---

const fileItem = z.object({
  key: z.string(),
  filename: z.string(),
  size: z.number(),
  sizeFormatted: z.string(),
  lastModified: z.unknown(),
});

export const getUsageResponse = z.object({
  username: z.string(),
  totalSize: z.number(),
  totalSizeFormatted: z.string(),
  fileCount: z.number(),
  files: z.array(fileItem),
});

export const listFilesResponse = z.object({
  files: z.array(fileItem),
  fileCount: z.number(),
});

export const storageErrorResponse = errorResponse;
