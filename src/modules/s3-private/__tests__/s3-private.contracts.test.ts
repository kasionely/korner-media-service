import { describe, it, expect } from "vitest";

import {
  generateUploadPresignedUrlResponse,
  generateAccessPresignedUrlResponse,
  getFileMetadataResponse,
  deletePrivateFileResponse,
  s3PrivateErrorResponse,
} from "../s3-private.validation";

describe("s3-private response contracts", () => {
  describe("generateUploadPresignedUrlResponse", () => {
    it("accepts valid presigned upload url", () => {
      const valid = {
        presignedUrl: "https://s3.amazonaws.com/bucket/key?X-Amz-Signature=abc",
        key: "user/file.webp",
        url: "https://cdn-private.korner.lol/user/file.webp",
      };
      expect(generateUploadPresignedUrlResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects without key", () => {
      const invalid = { presignedUrl: "https://s3.example.com", url: "https://cdn.example.com/f" };
      expect(generateUploadPresignedUrlResponse.safeParse(invalid).success).toBe(false);
    });
  });

  describe("generateAccessPresignedUrlResponse", () => {
    it("accepts valid access presigned url", () => {
      const valid = {
        presignedUrl: "https://cdn-private.korner.lol/user/file?sig=abc",
        expiresIn: 3600,
      };
      expect(generateAccessPresignedUrlResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects without expiresIn", () => {
      expect(
        generateAccessPresignedUrlResponse.safeParse({ presignedUrl: "https://url" }).success
      ).toBe(false);
    });
  });

  describe("getFileMetadataResponse", () => {
    it("accepts full metadata", () => {
      const valid = {
        key: "user/file.webp",
        metadata: {
          contentLength: 12345,
          etag: "abc123",
          cacheControl: "public, max-age=31536000, immutable",
        },
      };
      expect(getFileMetadataResponse.safeParse(valid).success).toBe(true);
    });

    it("accepts minimal metadata", () => {
      const valid = { key: "user/file.webp", metadata: {} };
      expect(getFileMetadataResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects without key", () => {
      expect(getFileMetadataResponse.safeParse({ metadata: {} }).success).toBe(false);
    });
  });

  describe("deletePrivateFileResponse", () => {
    it("accepts valid delete response", () => {
      const valid = { success: true, message: "File deleted successfully", key: "user/file.webp" };
      expect(deletePrivateFileResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects success: false", () => {
      expect(
        deletePrivateFileResponse.safeParse({ success: false, message: "ok", key: "k" }).success
      ).toBe(false);
    });
  });

  describe("s3PrivateErrorResponse", () => {
    it("accepts standard error", () => {
      const valid = { error: { code: "BAD_REQUEST", message: "File key is required" } };
      expect(s3PrivateErrorResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects flat error", () => {
      expect(s3PrivateErrorResponse.safeParse({ error: "bad" }).success).toBe(false);
    });
  });
});
