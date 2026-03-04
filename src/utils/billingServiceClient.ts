import axios from "axios";

const KORNER_BILLING_URL = process.env.KORNER_BILLING_URL || "http://localhost:3002";
const BILLING_TIMEOUT = 10000;

export interface SubscriptionInfo {
  hasActiveSubscription: boolean;
  planId?: number;
  subscriptionPlan?: string;
  period?: "daily" | "monthly" | "yearly";
  expiresAt?: Date;
}

export async function getActiveSubscriptionInfo(userId: number): Promise<SubscriptionInfo> {
  const url = `${KORNER_BILLING_URL}/internal/subscriptions/active?userId=${userId}`;
  try {
    const response = await axios.get(url, { timeout: BILLING_TIMEOUT });
    return response.data;
  } catch (error) {
    console.error("[billingClient] Failed to fetch subscription for userId:", userId, error instanceof Error ? error.message : error);
    throw new Error("Billing service unavailable");
  }
}

export async function hasUserPurchasedBar(userId: number, barId: string): Promise<boolean> {
  try {
    const response = await axios.get(
      `${KORNER_BILLING_URL}/internal/purchases/check?userId=${userId}&barId=${barId}`,
      { timeout: BILLING_TIMEOUT }
    );
    return response.data?.hasPurchased === true;
  } catch (error) {
    console.error("[billingClient] Failed to check purchase for userId:", userId, "barId:", barId, error instanceof Error ? error.message : error);
    throw new Error("Billing service unavailable");
  }
}
