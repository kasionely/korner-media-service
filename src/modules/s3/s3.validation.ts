import { z } from "zod";

import { errorResponse, messageUrlResponse } from "../../schemas/response.schema";

// --- Response Schemas ---

export const uploadImageResponse = messageUrlResponse;
export const uploadAudioResponse = messageUrlResponse;
export const uploadVideoResponse = messageUrlResponse;
export const uploadFileResponse = messageUrlResponse;

export const deleteFileResponse = z.object({
  message: z.string(),
  key: z.string(),
});

export const s3ErrorResponse = errorResponse;
