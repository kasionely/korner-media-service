import { Request, Response, NextFunction } from "express";

/**
 * Middleware to protect internal service-to-service endpoints.
 * Validates the x-internal-api-key header against INTERNAL_API_KEY env var.
 */
export const internalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-internal-api-key"];

  if (!process.env.INTERNAL_API_KEY) {
    console.error("INTERNAL_API_KEY is not configured");
    return res.status(500).json({
      error: { code: "SERVER_ERROR", message: "Internal auth not configured" },
    });
  }

  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid or missing internal API key" },
    });
  }

  next();
};
