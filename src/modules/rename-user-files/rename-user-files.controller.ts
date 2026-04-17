import { Request, Response } from "express";

import * as renameUserFilesService from "./rename-user-files.service";
import { ERROR_CODES } from "../../utils/errorCodes";
import { logger } from "../../utils/logger";

export async function renameUserFiles(req: Request, res: Response): Promise<void> {
  try {
    const { oldUsername, newUsername } = req.body;

    if (
      !oldUsername ||
      !newUsername ||
      typeof oldUsername !== "string" ||
      typeof newUsername !== "string"
    ) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "oldUsername and newUsername are required strings",
        },
      });
      return;
    }

    if (oldUsername === newUsername) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "oldUsername and newUsername must differ",
        },
      });
      return;
    }

    const result = await renameUserFilesService.renameUserFiles(oldUsername, newUsername);

    if (result.destinationNotEmpty) {
      res.status(409).json({
        error: {
          code: ERROR_CODES.RENAME_DESTINATION_NOT_EMPTY,
          message: `Folder "${newUsername}/" already exists in one of the buckets`,
          details: result.errors,
        },
      });
      return;
    }

    if (!result.success) {
      res.status(500).json({
        error: {
          code: ERROR_CODES.RENAME_FAILED,
          message: "Failed to rename files in one or more buckets",
          details: result.errors,
        },
        filesRenamed: result.filesRenamed,
      });
      return;
    }

    res.status(200).json({
      success: true,
      filesRenamed: result.filesRenamed,
      errors: result.errors,
    });
  } catch (error) {
    logger.error("Error in rename-user-files controller", { error: String(error) });
    res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Internal error" } });
  }
}
