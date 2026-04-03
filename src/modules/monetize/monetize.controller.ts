import { Request, Response } from "express";

import { processMonetization } from "./monetize.service";
import { ERROR_CODES } from "../../utils/errorCodes";
import { logger } from "../../utils/logger";

export async function monetize(req: Request, res: Response): Promise<void> {
  try {
    const { barId, barType, details, monetizedDetails } = req.body;

    if (!barId || !barType || !details) {
      res.status(400).json({
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: "barId, barType, and details are required" },
      });
      return;
    }

    const result = await processMonetization({
      barId,
      barType,
      details,
      monetizedDetails: monetizedDetails || {},
    });

    if (!result.success) {
      res.status(500).json({
        error: { code: ERROR_CODES.MONETIZATION_FAILED, message: result.error || "Monetization failed" },
      });
      return;
    }

    res.status(200).json({
      success: true,
      finalDetails: result.finalDetails,
      finalMonetizedDetails: result.finalMonetizedDetails,
    });
  } catch (error) {
    logger.error("Error in monetize controller:", { error: String(error) });
    res.status(500).json({ error: { code: ERROR_CODES.SERVER_ERROR, message: "Internal error" } });
  }
}
