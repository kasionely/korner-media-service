import axios from "axios";

function ensureProtocol(url: string): string {
  if (!/^https?:\/\//.test(url)) return `http://${url}`;
  return url;
}

const KORNER_MAIN_URL = ensureProtocol(process.env.KORNER_MAIN_URL || "http://localhost:3001");
console.log("[mainServiceClient] KORNER_MAIN_URL =", KORNER_MAIN_URL);

export interface InternalUser {
  id: number;
  username: string;
  email: string;
}

/**
 * Get authenticated user by JWT token (replaces getUserById + verifyToken)
 */
export async function getUserByToken(
  token: string
): Promise<{ user?: InternalUser; error?: string }> {
  try {
    const response = await axios.get(`${KORNER_MAIN_URL}/internal/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    return { user: response.data };
  } catch (error: any) {
    console.error("[getUserByToken] error:", error.message, "status:", error.response?.status, "url:", `${KORNER_MAIN_URL}/internal/users/me`);
    if (error.response?.status === 401) return { error: "unauthorized" };
    if (error.response?.status === 404) return { error: "not_found" };
    throw error;
  }
}

/**
 * Check if a user is the owner of a bar
 */
export async function isBarOwner(userId: number, barId: string): Promise<boolean> {
  try {
    const response = await axios.get(
      `${KORNER_MAIN_URL}/internal/bars/${barId}/owner?userId=${userId}`,
      { timeout: 5000 }
    );
    return response.data?.isOwner === true;
  } catch {
    return false;
  }
}

/**
 * Get bar associated with a private file key
 */
export async function getBarByFileKey(
  fileKey: string
): Promise<{ id: string; type: string } | null> {
  try {
    const response = await axios.get(
      `${KORNER_MAIN_URL}/internal/bars/by-file-key?key=${encodeURIComponent(fileKey)}`,
      { timeout: 5000 }
    );
    return response.data || null;
  } catch {
    return null;
  }
}
