import { Request, Response } from "express";

import { getUsernameFromToken, storageService } from "./storage.service";
import { ERROR_CODES } from "../../utils/errorCodes";

async function getAuthorizedUsername(
  req: Request,
  res: Response
): Promise<string | null> {
  const token = req.headers.authorization?.split(" ")[1];
  const result = await getUsernameFromToken(token);
  if (result.error) {
    res.status(result.error.status).json({ error: { code: result.error.code, message: result.error.message } });
    return null;
  }
  return result.username!;
}

export async function getUsage(req: Request, res: Response): Promise<void> {
  try {
    const username = await getAuthorizedUsername(req, res);
    if (!username) return;

    const result = await storageService.getUsage(username);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error retrieving storage usage:", error);
    res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to retrieve storage usage" } });
  }
}

export async function listFiles(req: Request, res: Response): Promise<void> {
  try {
    const username = await getAuthorizedUsername(req, res);
    if (!username) return;

    const result = await storageService.listFiles(username);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error retrieving file list:", error);
    res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Failed to retrieve file list" } });
  }
}
