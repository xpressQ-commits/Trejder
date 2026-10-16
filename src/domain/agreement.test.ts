import { describe, expect, it } from "vitest";
import {
  agreementParties,
  calculateAgreementAmounts,
  calculatePaymentSummary,
} from "./agreement";

describe("agreement money policy", () => {
  it("splits 500 000 SEK including VAT exactly", () => {
    expect(calculateAgreementAmounts(50_000_000, "deductible")).toEqual({
      totalOre: 50_000_000,
      netOre: 40_000_000,
      vatOre: 10_000_000,
    });
  });

  it("does not expose deductible VAT for margin-scheme vehicles", () => {
    expect(calculateAgreementAmounts(50_000_000, "margin_scheme")).toEqual({
      totalOre: 50_000_000,
      netOre: null,
      vatOre: null,
    });
  });

  it("uses deterministic integer rounding", () => {
    const result = calculateAgreementAmounts(10_001, "deductible");
    expect(result.netOre! + result.vatOre!).toBe(result.totalOre);
    expect(result).toEqual({ totalOre: 10_001, netOre: 8_001, vatOre: 2_000 });
  });

  it("subtracts finance allocations and rejects over-allocation", () => {
    expect(
      calculatePaymentSummary(50_000_000, [
        { recipient: "Finansbolag", amountOre: 32_000_000 },
      ]),
    ).toEqual({
      totalOre: 50_000_000,
      allocatedOre: 32_000_000,
      remainingOre: 18_000_000,
    });
    expect(() =>
      calculatePaymentSummary(100, [{ recipient: "Finans", amountOre: 101 }]),
    ).toThrow(/cannot exceed/);
  });
});
describe("agreement party direction", () => {
  it("maps company buys and company sells", () => {
    expect(agreementParties("company_buys")).toEqual({
      companyParty: "buyer",
      counterparty: "seller",
    });
    expect(agreementParties("company_sells")).toEqual({
      companyParty: "seller",
      counterparty: "buyer",
    });
  });
});
