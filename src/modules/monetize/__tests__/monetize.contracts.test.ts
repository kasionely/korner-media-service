import { describe, it, expect } from "vitest";

import { monetizeSuccessResponse, monetizeErrorResponse } from "../monetize.validation";

describe("monetize response contracts", () => {
  describe("monetizeSuccessResponse", () => {
    it("accepts successful monetization", () => {
      const valid = {
        success: true,
        finalDetails: { imageUrl: "https://cdn-private.korner.lol/user/img.webp" },
        finalMonetizedDetails: { price: 500, currencyCode: "USD" },
      };
      expect(monetizeSuccessResponse.safeParse(valid).success).toBe(true);
    });

    it("accepts with null details", () => {
      const valid = { success: true, finalDetails: null, finalMonetizedDetails: null };
      expect(monetizeSuccessResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects success: false", () => {
      const invalid = { success: false, finalDetails: {}, finalMonetizedDetails: {} };
      expect(monetizeSuccessResponse.safeParse(invalid).success).toBe(false);
    });

    it("rejects without success field", () => {
      expect(
        monetizeSuccessResponse.safeParse({ finalDetails: {}, finalMonetizedDetails: {} }).success
      ).toBe(false);
    });
  });

  describe("monetizeErrorResponse", () => {
    it("accepts standard error", () => {
      const valid = { error: { code: "MONETIZATION_FAILED", message: "Monetization failed" } };
      expect(monetizeErrorResponse.safeParse(valid).success).toBe(true);
    });

    it("rejects flat error", () => {
      expect(monetizeErrorResponse.safeParse({ error: "bad" }).success).toBe(false);
    });
  });
});
