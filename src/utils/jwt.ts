import jwt, { TokenExpiredError } from "jsonwebtoken";

import { ERROR_CODES } from "./errorCodes";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

export interface TokenPayload {
  userId: string;
  email: string;
}

type ErrorMessage = {
  code: string;
  message: string;
};

export const verifyAccessToken = (
  token: string
): { payload?: TokenPayload; error?: ErrorMessage } => {
  if (!ACCESS_TOKEN_SECRET) {
    throw new Error("ACCESS_TOKEN_SECRET is required");
  }

  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
    return { payload };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return { error: { code: ERROR_CODES.BASE_TOKEN_EXPIRED, message: "Token has expired" } };
    }
    return { error: { code: ERROR_CODES.BASE_INVALID_ACCESS_TOKEN, message: "Invalid token" } };
  }
};
