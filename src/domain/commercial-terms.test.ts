import { describe, expect, it } from "vitest";
import { currentDealerMatchFees } from "./commercial-terms";

describe("dealer commercial terms", () => {
  it("stores both fee sides as integer ore", () => {
    const fees = currentDealerMatchFees();
    expect(fees.sellerFeeExVatOre).toBe(49_900);
    expect(fees.buyerFeeExVatOre).toBe(49_900);
    expect(fees.sellerFeeExVatOre + fees.buyerFeeExVatOre).toBe(99_800);
    expect(Number.isInteger(fees.sellerFeeExVatOre)).toBe(true);
  });
});
