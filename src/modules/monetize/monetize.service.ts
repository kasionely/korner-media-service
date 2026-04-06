import { moveBarFilesToPrivateBucket, getMainContentFileKey } from "../../utils/fileTransfer";
import { logger } from "../../utils/logger";

interface MonetizeParams {
  barId: string;
  barType: string;
  details: any;
  monetizedDetails: {
    price?: number | null;
    currencyCode?: string | null;
    isAdult?: boolean;
    [key: string]: unknown;
  };
}

interface MonetizeResult {
  success: boolean;
  error?: string;
  finalDetails?: any;
  finalMonetizedDetails?: any;
}

export async function processMonetization({
  barId,
  barType,
  details,
  monetizedDetails,
}: MonetizeParams): Promise<MonetizeResult> {
  try {
    logger.info(`[monetize] Bar ${barId} (type=${barType}) is being monetized.`);
    logger.info(
      `[monetize] Input details keys: ${details ? Object.keys(details).join(", ") : "null"}`
    );
    logger.info("[monetize] Input monetizedDetails", { data: monetizedDetails });

    const fileTransferResult = await moveBarFilesToPrivateBucket(barId, barType, details, null);

    logger.info("[monetize] File transfer result", {
      success: fileTransferResult.success,
      movedFiles: fileTransferResult.movedFiles,
      hasUpdatedDetails: !!fileTransferResult.updatedDetails,
      error: fileTransferResult.error,
    });

    if (!fileTransferResult.success) {
      logger.error(`[monetize] Failed to move files for bar ${barId}`, undefined, {
        error: fileTransferResult.error,
      });
      return { success: false, error: fileTransferResult.error };
    }

    let finalDetails = fileTransferResult.updatedDetails || details;

    if (fileTransferResult.movedFiles && fileTransferResult.movedFiles.length > 0) {
      const detailsCopy = { ...finalDetails };

      switch (barType) {
        case "File":
          delete detailsCopy.fileUrl;
          break;
        case "Audio":
          delete detailsCopy.audioUrl;
          break;
      }

      finalDetails = detailsCopy;
    }

    const originalDetailsForKey = fileTransferResult.updatedDetails || details;
    const movedFilesCount = fileTransferResult.movedFiles?.length || 0;
    const contentFileKey = getMainContentFileKey(barType, originalDetailsForKey, movedFilesCount);

    logger.info(
      `[monetize] Key extraction: movedFilesCount=${movedFilesCount}, contentFileKey=${contentFileKey}`
    );

    let finalMonetizedDetails = monetizedDetails;
    if (contentFileKey) {
      const hasValidMonetizedData =
        monetizedDetails &&
        typeof monetizedDetails.price === "number" &&
        typeof monetizedDetails.currencyCode === "string";

      if (hasValidMonetizedData) {
        finalMonetizedDetails = {
          price: monetizedDetails.price as number,
          currencyCode: monetizedDetails.currencyCode as string,
          isAdult: Boolean(monetizedDetails.isAdult),
          key: contentFileKey,
        };
      } else {
        finalMonetizedDetails = {
          price: null,
          currencyCode: null,
          isAdult: false,
          key: contentFileKey,
        };
      }
    } else {
      logger.warn(
        `[monetize] No contentFileKey extracted for bar ${barId}. finalMonetizedDetails will not have key from media-service.`
      );
    }

    logger.info("[monetize] Result finalMonetizedDetails", { data: finalMonetizedDetails });

    return {
      success: true,
      finalDetails,
      finalMonetizedDetails,
    };
  } catch (error) {
    logger.error(`Error processing monetization for bar ${barId}:`, { error: String(error) });
    return { success: false, error: (error as Error).message };
  }
}
