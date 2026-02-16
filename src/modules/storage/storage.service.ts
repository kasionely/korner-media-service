import { ERROR_CODES } from "../../utils/errorCodes";
import { getUserByToken } from "../../utils/mainServiceClient";
import { getUserStorageUsage } from "../../utils/s3.utils";

export class StorageError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export async function getUsernameFromToken(
  token: string | undefined
): Promise<{ username?: string; error?: { status: number; code: string; message: string } }> {
  if (!token) {
    return { error: { status: 401, code: ERROR_CODES.BASE_AUTH_TOKEN_REQUIRED, message: "Authorization token required" } };
  }

  const { user, error } = await getUserByToken(token);

  if (error === "not_found" || !user || !user.username) {
    return { error: { status: 404, code: ERROR_CODES.PROFILE_NOTFOUND, message: "User profile not found" } };
  }

  if (error === "unauthorized") {
    return { error: { status: 401, code: ERROR_CODES.BASE_INVALID_ACCESS_TOKEN, message: "Invalid token" } };
  }

  return { username: user.username };
}

class StorageService {
  async getUsage(username: string) {
    const storageUsage = await getUserStorageUsage(username);

    return {
      username,
      totalSize: storageUsage.totalSize,
      totalSizeFormatted: formatSize(storageUsage.totalSize),
      fileCount: storageUsage.fileCount,
      files: storageUsage.files.map((file) => ({
        key: file.key,
        filename: file.key.replace(`${username}/`, ""),
        size: file.size,
        sizeFormatted: formatSize(file.size),
        lastModified: file.lastModified,
      })),
    };
  }

  async listFiles(username: string) {
    const storageUsage = await getUserStorageUsage(username);

    return {
      files: storageUsage.files.map((file) => ({
        key: file.key,
        filename: file.key.replace(`${username}/`, ""),
        size: file.size,
        sizeFormatted: formatSize(file.size),
        lastModified: file.lastModified,
      })),
      fileCount: storageUsage.fileCount,
    };
  }
}

export const storageService = new StorageService();
