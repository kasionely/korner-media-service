import "express";

declare module "express" {
  interface Request {
    auth?: {
      userId: number;
    };
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
}
