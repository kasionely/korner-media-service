import { z } from "zod";

export const messageResponse = z.object({
  message: z.string(),
});

export const messageUrlResponse = z.object({
  message: z.string(),
  url: z.string(),
});

export const errorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export const successMessageResponse = z.object({
  success: z.literal(true),
  message: z.string(),
});
