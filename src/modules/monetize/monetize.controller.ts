import { Request, Response } from "express";

import { processMonetization } from "./monetize.service";

export async function monetize(req: Request, res: Response): Promise<void> {
  try {
    const { barId, barType, details, monetizedDetails } = req.body;

    if (!barId || !barType || !details) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "barId, barType, and details are required" },
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
        error: { code: "MONETIZATION_FAILED", message: result.error || "Monetization failed" },
      });
      return;
    }

    res.status(200).json({
      success: true,
      finalDetails: result.finalDetails,
      finalMonetizedDetails: result.finalMonetizedDetails,
    });
  } catch (error) {
    console.error("Error in monetize controller:", error);
    res.status(500).json({ error: { code: "SERVER_ERROR", message: "Internal error" } });
  }
}
