import sharp from "sharp";

interface ProcessImageOptions {
  buffer?: Buffer;
  filePath?: string;
  filename: string;
  mimetype?: string;
}

export async function compressImage({ buffer, filePath, filename, mimetype }: ProcessImageOptions) {
  const outputFilename = `compressed-${Date.now()}-${filename}.webp`;
  const imageQuality = Number(process.env.IMAGE_QUALITY) || 80;

  const originalSize = buffer ? buffer.length : 0;

  try {
    let sharpInstance;

    if (buffer) {
      if (mimetype === "image/gif") {
        sharpInstance = sharp(buffer, { animated: true, pages: -1, limitInputPixels: false });
      } else {
        sharpInstance = sharp(buffer, { limitInputPixels: false });
      }
    } else if (filePath) {
      sharpInstance = sharp(filePath, { limitInputPixels: false });
    } else {
      throw new Error("Either buffer or filePath must be provided");
    }

    const metadata = await sharpInstance.metadata();
    const isAnimated = metadata.pages && metadata.pages > 1;

    const webpOptions: sharp.WebpOptions = {
      quality: imageQuality,
      effort: 6,
    };

    if (isAnimated) {
      webpOptions.loop = 0;
    }

    const compressedBuffer = await sharpInstance.webp(webpOptions).toBuffer();

    if (originalSize > 0 && compressedBuffer.length > originalSize) {
      return {
        success: true,
        buffer: buffer!,
        outputFilename: `${Date.now()}-${filename}`,
        isAnimated: false,
        skipConversion: true,
      };
    }

    return {
      success: true,
      buffer: compressedBuffer,
      outputFilename,
      isAnimated: false,
      skipConversion: false,
    };
  } catch (error: any) {
    if (error.message && error.message.includes("Input image exceeds pixel limit")) {
      throw new Error("Image is too large to process. Please reduce image size or dimensions.");
    }
    if (error.message && error.message.includes("Input buffer contains unsupported image format")) {
      throw new Error("Unsupported image format. Please use JPEG, PNG, GIF, or WebP.");
    }
    throw error;
  }
}
