import { describe, expect, it } from "vitest";
import { dealerCounterpartyLabel, normalizeChatBody } from "./chat";

const parties = {
  sellerCompanyId: "seller",
  buyerCompanyId: "buyer",
  sellerName: "Säljaren AB",
  buyerName: "Hemliga Köparen AB",
  anonymousNumber: 3,
};

describe("chat identity policy", () => {
  it("keeps the buyer anonymous to the seller before an accepted winning bid", () => {
    expect(dealerCounterpartyLabel({ ...parties, viewerCompanyId: "seller", identityRevealed: false }))
      .toBe("Handlare C");
  });

  it("reveals the buyer to the seller only after a match", () => {
    expect(dealerCounterpartyLabel({ ...parties, viewerCompanyId: "seller", identityRevealed: true }))
      .toBe("Hemliga Köparen AB");
  });

  it("keeps the private seller anonymous to the buyer before a match", () => {
    expect(dealerCounterpartyLabel({ ...parties, viewerCompanyId: "buyer", identityRevealed: false }))
      .toBe("Säljaren");
  });

  it("reveals the seller to the winning buyer after a match", () => {
    expect(dealerCounterpartyLabel({ ...parties, viewerCompanyId: "buyer", identityRevealed: true }))
      .toBe("Säljaren AB");
  });

  it("rejects blank and oversized messages", () => {
    expect(normalizeChatBody("  Hej!  ")).toBe("Hej!");
    expect(() => normalizeChatBody("   ")).toThrow("INVALID_CHAT_MESSAGE");
    expect(() => normalizeChatBody("x".repeat(2001))).toThrow("INVALID_CHAT_MESSAGE");
  });
});
