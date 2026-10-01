import { describe, expect, it } from "vitest";
import { listingInputSchema, parseImagePosition } from "./http";

const valid = {
  identifier: { kind: "model" as const, value: "BMW M340i" },
  modelYear: new Date().getUTCFullYear(),
  mileageMil: 6430,
  shortComment: "Svensksåld.",
  deductibleVat: true,
};

describe("vehicle listing transport contract", () => {
  it("accepts the model-based listing fields", () => {
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

describe("image position contract", () => {
  it("accepts positions one through five and rejects six", () => {
    expect([1, 2, 3, 4, 5].map((position) => parseImagePosition(String(position))))
      .toEqual([1, 2, 3, 4, 5]);
    expect(() => parseImagePosition("6")).toThrowError(expect.objectContaining({ code: "IMAGE_NOT_FOUND" }));
  });

  it("does not accept registration number as new listing identity", () => {
    expect(listingInputSchema.safeParse({ ...valid, identifier: { kind: "registration", value: "ABC123" } }).success).toBe(false);
  });

  it("requires an integer model year from 1950 through next year", () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    expect(listingInputSchema.safeParse({ ...valid, modelYear: 1950 }).success).toBe(true);
    expect(listingInputSchema.safeParse({ ...valid, modelYear: nextYear }).success).toBe(true);
    expect(listingInputSchema.safeParse({ ...valid, modelYear: undefined }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...valid, modelYear: 1949 }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...valid, modelYear: nextYear + 1 }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...valid, modelYear: 2020.5 }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...valid, modelYear: "2020" }).success).toBe(false);
  });
});
