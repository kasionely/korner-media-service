import { z } from "zod";

import { errorResponse } from "../../schemas/response.schema";

// --- Response Schemas ---

export const monetizeSuccessResponse = z.object({
  success: z.literal(true),
  finalDetails: z.unknown(),
  finalMonetizedDetails: z.unknown(),
});

export const monetizeErrorResponse = errorResponse;
