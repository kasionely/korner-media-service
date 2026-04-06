import { describe, it, expect } from "vitest";

import { getUsageResponse, listFilesResponse, storageErrorResponse } from "../storage.validation";

describe("storage response contracts", () => {
  describe("getUsageResponse", () => {
    it("accepts full storage usage", () => {
      const valid = {
        username: "testuser",
        totalSize: 1048576,
        totalSizeFormatted: "1 MB",
        fileCount: 2,
        files: [
          {
            key: "testuser/img.webp",
            filename: "img.webp",
            size: 524288,
            sizeFormatted: "512 KB",
            lastModified: "2025-01-01T00:00:00Z",
          },
          {
            key: "testuser/doc.pdf",
            filename: "doc.pdf",
            size: 524288,
            sizeFormatted: "512 KB",
            lastModified: "2025-01-01T00:00:00Z",
          },
        ],
      };
      expect(getUsageResponse.safeParse(valid).success).toBe(true);
    });

    it("accepts empty files", () => {
      const valid = {
        username: "testuser",
        totalSize: 0,
        totalSizeFormatted: "0 B",
        fileCount: 0,
        files: [],
      };
      expect(getUsageResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects without username", () => {
      expect(
        getUsageResponse.safeParse({
          totalSize: 0,
          totalSizeFormatted: "0 B",
          fileCount: 0,
          files: [],
        }).success
      ).toBe(false);
    });
  });

  describe("listFilesResponse", () => {
    it("accepts file list", () => {
      const valid = {
        files: [
          {
            key: "user/f.webp",
            filename: "f.webp",
            size: 100,
            sizeFormatted: "100 B",
            lastModified: null,
          },
        ],
        fileCount: 1,
      };
      expect(listFilesResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects without fileCount", () => {
      expect(listFilesResponse.safeParse({ files: [] }).success).toBe(false);
    });
  });

  describe("storageErrorResponse", () => {
    it("accepts standard error", () => {
      const valid = {
        error: { code: "SERVER_ERROR", message: "Failed to retrieve storage usage" },
      };
      expect(storageErrorResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects flat error", () => {
      expect(storageErrorResponse.safeParse({ error: "bad" }).success).toBe(false);
    });
  });
});
