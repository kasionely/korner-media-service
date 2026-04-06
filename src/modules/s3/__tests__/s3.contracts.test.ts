import { describe, it, expect } from "vitest";

import {
  uploadImageResponse,
  uploadAudioResponse,
  uploadVideoResponse,
  uploadFileResponse,
  deleteFileResponse,
  s3ErrorResponse,
} from "../s3.validation";

describe("s3 response contracts", () => {
  describe("upload responses", () => {
    it("accepts image upload response", () => {
      const valid = {
        message: "Image uploaded successfully",
        url: "https://cdn.korner.lol/user/file.webp",
      };
      expect(uploadImageResponse.safeParse(valid).success).toBe(true);
    });

    it("accepts audio upload response", () => {
      const valid = {
        message: "Audio uploaded successfully",
        url: "https://cdn.korner.lol/user/file.mp3",
      };
      expect(uploadAudioResponse.safeParse(valid).success).toBe(true);
    });

    it("accepts video upload response", () => {
      const valid = {
        message: "Video uploaded successfully",
        url: "https://cdn.korner.lol/user/file.mp4",
      };
      expect(uploadVideoResponse.safeParse(valid).success).toBe(true);
    });

    it("accepts file upload response", () => {
      const valid = {
        message: "File uploaded successfully",
        url: "https://cdn.korner.lol/user/file.pdf",
      };
      expect(uploadFileResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects upload without url", () => {
      expect(uploadImageResponse.safeParse({ message: "done" }).success).toBe(false);
    });

    it("rejects upload without message", () => {
      expect(uploadImageResponse.safeParse({ url: "https://cdn.korner.lol/f.webp" }).success).toBe(
        false
      );
    });
  });

  describe("deleteFileResponse", () => {
    it("accepts valid delete response", () => {
      const valid = { message: "File deleted successfully", key: "user/file.webp" };
      expect(deleteFileResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects without key", () => {
      expect(deleteFileResponse.safeParse({ message: "deleted" }).success).toBe(false);
    });
  });

  describe("s3ErrorResponse", () => {
    it("accepts standard error", () => {
      const valid = { error: { code: "BAD_REQUEST", message: "No image file provided" } };
      expect(s3ErrorResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects flat error string", () => {
      expect(s3ErrorResponse.safeParse({ error: "Failed to retrieve file" }).success).toBe(false);
    });
  });
});
