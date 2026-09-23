import { describe, expect, it } from "vitest";
import { listingInputSchema } from "./http";

const valid = {
  identifier: { kind: "registration" as const, value: "ABC123" },
  mileageMil: 6430,
  shortComment: "Svensksåld.",
  deductibleVat: true,
};

describe("vehicle listing transport contract", () => {
  it("accepts only the five Phase 2 fields", () => {
    expect(listingInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects forged tenant, owner, status and normalized mileage fields", () => {
    for (const extra of [
      { sellerCompanyId: "forged" },
      { createdByUserId: "forged" },
      { status: "active" },
      { mileageKm: 1 },
    ]) {
      expect(listingInputSchema.safeParse({ ...valid, ...extra }).success).toBe(false);
    }
  });

  it("rejects fractional and implausible Swedish mil", () => {
    expect(listingInputSchema.safeParse({ ...valid, mileageMil: 1.5 }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...valid, mileageMil: 200_001 }).success).toBe(false);
  });
});
