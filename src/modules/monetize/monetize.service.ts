import { moveBarFilesToPrivateBucket, getMainContentFileKey } from "../../utils/fileTransfer";

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
    console.log(`Bar ${barId} is being monetized. Moving details files to private bucket...`);

    const fileTransferResult = await moveBarFilesToPrivateBucket(barId, barType, details, null);

    if (!fileTransferResult.success) {
      console.error(`Failed to move files for bar ${barId}:`, fileTransferResult.error);
      return { success: false, error: fileTransferResult.error };
    }

    let finalDetails = fileTransferResult.updatedDetails || details;

    if (fileTransferResult.movedFiles && fileTransferResult.movedFiles.length > 0) {
      const detailsCopy = { ...finalDetails };

      switch (barType) {
        case "File":
          delete detailsCopy.fileUrl;
          break;
        case "Video":
          delete detailsCopy.link;
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
    }

    return {
      success: true,
      finalDetails,
      finalMonetizedDetails,
    };
  } catch (error) {
    console.error(`Error processing monetization for bar ${barId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}
