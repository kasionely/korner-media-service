import { Request, Response, NextFunction } from "express";

import { ERROR_CODES } from "../utils/errorCodes";
import { verifyAccessToken } from "../utils/jwt";
import { getUserByToken, isBarOwner, getBarByFileKey } from "../utils/mainServiceClient";
import { getActiveSubscriptionInfo, hasUserPurchasedBar } from "../utils/billingServiceClient";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
  subscription?: {
    hasActiveSubscription: boolean;
    planId?: number;
    subscriptionPlan?: string;
    period?: "daily" | "monthly" | "yearly";
    expiresAt?: Date;
  };
}

export type SubscriptionRequest = AuthenticatedRequest;

/**
 * Authenticates user via JWT, fetches user info from korner-main-service.
 * Populates req.user = { id, username }
 */
export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      res.status(401).json({
        error: { code: ERROR_CODES.BASE_AUTH_TOKEN_REQUIRED, message: "Authorization token required" },
      });
      return;
    }

    // Verify JWT locally first (no network call needed)
    const decoded = verifyAccessToken(token);
    if (decoded.error) {
      res.status(401).json({ error: { code: decoded.error.code, message: decoded.error.message } });
      return;
    }

    // Fetch user details from korner-main-service
    const { user, error } = await getUserByToken(token);

    if (error === "unauthorized") {
      res.status(401).json({
        error: { code: ERROR_CODES.BASE_INVALID_ACCESS_TOKEN, message: "Invalid token" },
      });
      return;
    }

    if (error === "not_found" || !user || !user.username) {
      res.status(404).json({
        error: { code: ERROR_CODES.PROFILE_NOTFOUND, message: "User profile not found" },
      });
      return;
    }

    req.user = { id: user.id, username: user.username };
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({
      error: { code: ERROR_CODES.SERVER_ERROR, message: "Authentication failed" },
    });
  }
};

/**
 * Requires active subscription. Call after authenticateUser.
 * Fetches subscription info from korner-billing-service.
 */
export const requireSubscription = async (
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { code: ERROR_CODES.BASE_AUTH_TOKEN_REQUIRED, message: "User not authenticated" },
      });
      return;
    }

    const subscriptionInfo = await getActiveSubscriptionInfo(req.user.id);
    if (!subscriptionInfo.hasActiveSubscription) {
      res.status(403).json({
        error: { code: ERROR_CODES.SUBSCRIPTION_REQUIRED, message: "Active subscription required" },
      });
      return;
    }

    req.subscription = subscriptionInfo;
    next();
  } catch (error) {
    console.error("Subscription check error:", error);
    res.status(500).json({
      error: { code: ERROR_CODES.SERVER_ERROR, message: "Subscription verification failed" },
    });
  }
};

/**
 * Checks content access: owner OR purchaser OR active subscriber.
 * Calls korner-main (bar ownership) and korner-billing (purchases/subscriptions).
 */
export const checkContentAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { code: ERROR_CODES.BASE_AUTH_TOKEN_REQUIRED, message: "User not authenticated" },
      });
      return;
    }

    const fileKey = req.body?.key || req.params?.key;

    if (!fileKey) {
      res.status(400).json({
        error: { code: ERROR_CODES.BAD_REQUEST, message: "File key is required" },
      });
      return;
    }

    // Check bar ownership via korner-main-service
    const bar = await getBarByFileKey(fileKey);

    if (bar) {
      const ownerCheck = await isBarOwner(req.user.id, bar.id);
      if (ownerCheck) {
        next();
        return;
      }

      const purchaseCheck = await hasUserPurchasedBar(req.user.id, bar.id);
      if (purchaseCheck) {
        next();
        return;
      }
    }

    // Fallback: check subscription via korner-billing-service
    const subscriptionInfo = await getActiveSubscriptionInfo(req.user.id);
    if (subscriptionInfo.hasActiveSubscription) {
      next();
      return;
    }

    res.status(403).json({
      error: {
        code: ERROR_CODES.SUBSCRIPTION_REQUIRED,
        message: "Active subscription or purchase required for content access",
      },
    });
  } catch (error) {
    console.error("Content access check error:", error);
    res.status(500).json({
      error: { code: ERROR_CODES.SERVER_ERROR, message: "Access verification failed" },
    });
  }
};
