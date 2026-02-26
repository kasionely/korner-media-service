import axios from "axios";

const KORNER_BILLING_URL = process.env.KORNER_BILLING_URL || "http://localhost:3002";

export interface SubscriptionInfo {
  hasActiveSubscription: boolean;
  planId?: number;
  subscriptionPlan?: string;
  period?: "daily" | "monthly" | "yearly";
  expiresAt?: Date;
}

/**
 * Get active subscription info for a user
 */
export async function getActiveSubscriptionInfo(userId: number): Promise<SubscriptionInfo> {
  try {
    const response = await axios.get(
      `${KORNER_BILLING_URL}/internal/subscriptions/active?userId=${userId}`,
      { timeout: 5000 }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to fetch subscription info for userId:", userId, error instanceof Error ? error.message : error);
    return { hasActiveSubscription: false };
  }
}

/**
 * Check if a user has purchased a specific bar
 */
export async function hasUserPurchasedBar(userId: number, barId: string): Promise<boolean> {
  try {
    const response = await axios.get(
      `${KORNER_BILLING_URL}/internal/purchases/check?userId=${userId}&barId=${barId}`,
      { timeout: 5000 }
    );
    return response.data?.hasPurchased === true;
  } catch {
    return false;
  }
}
