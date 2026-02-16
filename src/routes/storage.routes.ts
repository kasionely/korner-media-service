import { Request, Response, Router } from "express";

import { authMiddleware } from "../middleware/authMiddleware";
import { ERROR_CODES } from "../utils/errorCodes";
import { getUserByToken } from "../utils/mainServiceClient";
import { getUserStorageUsage } from "../utils/s3.utils";

const router = Router();

async function getUsernameFromRequest(
  req: Request
): Promise<{ username?: string; error?: { status: number; code: string; message: string } }> {
  const token = req.headers.authorization?.split(" ")[1];
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

const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

router.get("/usage", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await getUsernameFromRequest(req);
    if (result.error) {
      res.status(result.error.status).json({
        error: { code: result.error.code, message: result.error.message },
      });
      return;
    }

    const username = result.username!;
    const storageUsage = await getUserStorageUsage(username);

    res.status(200).json({
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
    });
  } catch (error) {
    console.error("Error retrieving storage usage:", error);
    res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to retrieve storage usage" } });
  }
});

router.get("/list", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await getUsernameFromRequest(req);
    if (result.error) {
      res.status(result.error.status).json({
        error: { code: result.error.code, message: result.error.message },
      });
      return;
    }

    const username = result.username!;
    const storageUsage = await getUserStorageUsage(username);

    res.status(200).json({
      files: storageUsage.files.map((file) => ({
        key: file.key,
        filename: file.key.replace(`${username}/`, ""),
        size: file.size,
        sizeFormatted: formatSize(file.size),
        lastModified: file.lastModified,
      })),
      fileCount: storageUsage.fileCount,
    });
  } catch (error) {
    console.error("Error retrieving file list:", error);
    res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to retrieve file list" } });
  }
});

export default router;
