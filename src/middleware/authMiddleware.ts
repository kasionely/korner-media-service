import { Request, Response, NextFunction } from "express";

import { ERROR_CODES } from "../utils/errorCodes";
import { verifyAccessToken } from "../utils/jwt";

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({
      error: {
        code: ERROR_CODES.BASE_AUTH_TOKEN_REQUIRED,
        message: "Authorization token required",
      },
    });
    return;
  }

  const result = verifyAccessToken(token);

  if (result.error) {
    res.status(401).json({ error: result.error });
    return;
  }

  req.auth = { userId: Number(result.payload!.userId) };
  next();
};
